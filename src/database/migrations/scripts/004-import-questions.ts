import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import TurndownService from 'turndown';
import { IMigration } from '../migration-runner';
import { Subject } from '../../../exams/entities/subject.entity';
import { ExamTypeSubject } from '../../../exams/entities/exam-type-subject.entity';
import { Topic } from '../../../exams/entities/topic.entity';
import { Question } from '../../../exams/entities/question.entity';
import { QuestionCategory, QuestionType } from '../../../../types';

// ─── Course → ExamType name (matches new schema exactly) ─────────────────────
const COURSE_TO_EXAM_TYPE: Record<string, string> = {
  '13': 'JAMB',
  '14': 'WAEC',
  '15': 'NECO',
  '16': 'GCE', // Legacy "NECO GCE" → new schema "GCE"
  '17': 'POST-JAMB', // Legacy "POST-UTME" → new schema "POST-JAMB"
};

// Exam types that share the same question bank (WAEC is canonical)
const SHARED_EXAM_TYPES = new Set(['WAEC', 'NECO', 'GCE']);
// Process order: WAEC first so it becomes canonical for shared questions
const PROCESS_ORDER = ['WAEC', 'NECO', 'GCE', 'JAMB', 'POST-JAMB'];

// ─── Legacy subject title (lowercased) → new Subject name ────────────────────
const SUBJECT_NAME_MAP: Record<string, string> = {
  english: 'English Language',
  'literature-in-english': 'Literature in English',
  'literature in english': 'Literature in English',
  'christian religion knowledge (crk)': 'Christian Religious Studies',
  'christian religious knowledge': 'Christian Religious Studies',
  'islamic religion knowledge (irk)': 'Islamic Studies',
  'islamic religious knowledge': 'Islamic Studies',
  'financial accounting': 'Accounting',
  'agricultural science': 'Agricultural Science',
  computer: 'Computer Studies',
  'civic education': 'Civic Education',
  commerce: 'Commerce',
  economics: 'Economics',
  government: 'Government',
  mathematics: 'Mathematics',
  biology: 'Biology',
  chemistry: 'Chemistry',
  physics: 'Physics',
  yoruba: 'Yoruba',
  igbo: 'Igbo',
  hausa: 'Hausa',
  history: 'History',
  geography: 'Geography',
  'further mathematics': 'Further Mathematics',
  french: 'French',
};

// ─── Legacy question_type → QuestionType + QuestionCategory ──────────────────
const QUESTION_TYPE_MAP: Record<
  string,
  { type: QuestionType; category: QuestionCategory }
> = {
  Objective: {
    type: QuestionType.MULTIPLE_CHOICE,
    category: QuestionCategory.OBJECTIVES,
  },
  Theory: { type: QuestionType.ESSAY, category: QuestionCategory.THEORY },
  Practical: { type: QuestionType.ESSAY, category: QuestionCategory.PRACTICAL },
};

// ─── Superscript / subscript → Unicode or KaTeX ──────────────────────────────
const SUPER_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
  '–': '⁻',
  '+': '⁺',
  '∘': '°',
  o: '°',
  // letter variables with Unicode superscript equivalents
  a: 'ᵃ',
  b: 'ᵇ',
  c: 'ᶜ',
  d: 'ᵈ',
  e: 'ᵉ',
  f: 'ᶠ',
  g: 'ᵍ',
  h: 'ʰ',
  i: 'ⁱ',
  j: 'ʲ',
  k: 'ᵏ',
  l: 'ˡ',
  m: 'ᵐ',
  n: 'ⁿ',
  p: 'ᵖ',
  r: 'ʳ',
  s: 'ˢ',
  t: 'ᵗ',
  u: 'ᵘ',
  v: 'ᵛ',
  w: 'ʷ',
  x: 'ˣ',
  y: 'ʸ',
  z: 'ᶻ',
};

const SUB_MAP: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
};

function normaliseScriptContent(raw: string): string {
  return (
    raw
      .replace(/\\(.)/g, '$1')
      .replace(/[_*`~]/g, '')
      .replace(/&nbsp;/g, '')
      // eslint-disable-next-line no-irregular-whitespace
      .replace(/ /g, '')
      // eslint-disable-next-line no-irregular-whitespace
      .replace(/​/g, '') // zero-width spaces
      .trim()
  );
}

function toUnicodeSup(raw: string): string {
  const clean = normaliseScriptContent(raw);
  let result = '';
  for (const ch of clean) {
    const mapped = SUPER_MAP[ch];
    if (mapped !== undefined) result += mapped;
    else return `$^{${clean}}$`;
  }
  return result;
}

function toUnicodeSub(raw: string): string {
  const clean = normaliseScriptContent(raw);
  let result = '';
  for (const ch of clean) {
    const mapped = SUB_MAP[ch];
    if (mapped !== undefined) result += mapped;
    else return `$_{\\text{${clean}}}$`;
  }
  return result;
}

function buildTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
  });

  td.addRule('mathjax-inline', {
    filter: (node: HTMLElement) =>
      node.nodeName === 'SPAN' &&
      (node.className?.includes('math-tex') ||
        (node.textContent?.trim().startsWith('\\(') ?? false)),
    replacement: (_content: string, node: Node) => {
      const text = (node as HTMLElement).textContent || '';
      return text
        .replace(/\\\((.+?)\\\)/gs, '$$$1$$')
        .replace(/\\\[(.+?)\\\]/gs, '$$$$$1$$$$');
    },
  });

  td.addRule('strip-style-spans', {
    filter: (node: HTMLElement) =>
      node.nodeName === 'SPAN' &&
      !!node.getAttribute('style') &&
      !node.className?.includes('math-tex'),
    replacement: (content: string) => content,
  });

  td.addRule('superscript', {
    filter: 'sup',
    replacement: (content: string) => toUnicodeSup(content),
  });

  td.addRule('subscript', {
    filter: 'sub',
    replacement: (content: string) => toUnicodeSub(content),
  });

  td.addRule('underline', {
    filter: 'u',
    replacement: (content: string) => content,
  });

  td.addRule('tablecell', {
    filter: ['th', 'td'],
    replacement: (content: string) =>
      ` ${content.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim()} |`,
  });

  td.addRule('tablerow', {
    filter: 'tr',
    replacement: (content: string) => `|${content}\n`,
  });

  td.addRule('table', {
    filter: 'table',
    replacement: (content: string, node: Node) => {
      const colCount = Math.max(
        ...Array.from((node as HTMLElement).querySelectorAll('tr')).map(
          (tr) => tr.querySelectorAll('th, td').length,
        ),
      );
      const separator = `| ${Array(colCount).fill('---').join(' | ')} |`;
      const lines = content
        .trim()
        .split('\n')
        .filter((l) => l.trim());
      if (!lines.length) return '';
      return (
        '\n\n' +
        lines[0] +
        '\n' +
        separator +
        '\n' +
        lines.slice(1).join('\n') +
        '\n\n'
      );
    },
  });

  td.addRule('figure', {
    filter: 'figure',
    replacement: (content: string) => content,
  });

  return td;
}

const td = buildTurndown();

function htmlToMd(html: string | null | undefined): string {
  if (!html) return '';
  const cleaned = html
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!cleaned) return '';
  try {
    return td.turndown(cleaned).trim();
  } catch {
    return cleaned.replace(/<[^>]+>/g, '').trim();
  }
}

// ─── Content-hash deduplication ───────────────────────────────────────────────
// Normalize and hash subjectName + questionText to detect cross-type duplicates.
function contentHash(subjectName: string, questionText: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto
    .createHash('md5')
    .update(norm(subjectName) + '||' + norm(questionText))
    .digest('hex');
}

// ─── Legacy data shape ────────────────────────────────────────────────────────
interface LegacyQuestion {
  id: string;
  questionid: string;
  course: string;
  subject: string;
  topic: string;
  question: string;
  answer_description: string;
  question_type: string;
  parent: string;
}

interface LegacyOption {
  id: string;
  questionid: string;
  questions_options: string;
  answer: string; // '1' = correct, '0' = wrong
}

interface LegacySubject {
  id: string;
  course: string;
  title: string;
}

interface LegacyTopic {
  id: string;
  course: string;
  subject: string; // legacy subject id
  topic: string; // topic name
  dcp: string; // HTML content
}

export const migration004: IMigration = {
  name: '004-import-questions',
  description:
    'Imports legacy questions with content-hash dedup across WAEC/NECO/GCE (HTML→Markdown)',

  async run(dataSource: DataSource): Promise<void> {
    // ── Ensure join table exists ───────────────────────────────────────────
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS "question_exam_type_subjects" (
        "questionId" uuid NOT NULL,
        "examTypeSubjectId" uuid NOT NULL,
        CONSTRAINT "PK_question_ets" PRIMARY KEY ("questionId", "examTypeSubjectId"),
        CONSTRAINT "FK_qets_question" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_qets_ets" FOREIGN KEY ("examTypeSubjectId") REFERENCES "exam_type_subjects"("id") ON DELETE CASCADE
      )
    `);
    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_qets_ets" ON "question_exam_type_subjects" ("examTypeSubjectId")
    `);

    // ── Load legacy JSON ───────────────────────────────────────────────────
    const jsonPath = path.resolve(
      __dirname,
      '../../../../../Previous Site Data.transformed.json',
    );
    if (!fs.existsSync(jsonPath)) {
      throw new Error(
        `Legacy data file not found at: ${jsonPath}\n` +
          `  Expected: iExcelo/Previous Site Data.transformed.json`,
      );
    }

    console.log('    Loading legacy JSON (this may take a moment)...');
    const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as Array<{
      type: string;
      name: string;
      data: unknown[];
    }>;

    const tableMap = new Map<string, unknown[]>();
    for (const entry of rawData) {
      if (entry.type === 'table') tableMap.set(entry.name, entry.data);
    }

    const allLegacyQuestions = (tableMap.get('questions') ??
      []) as LegacyQuestion[];
    // Deduplicate by questionid — 42 duplicates in legacy export
    const seenQids = new Set<string>();
    const legacyQuestions = allLegacyQuestions.filter((q) => {
      if (seenQids.has(q.questionid)) return false;
      seenQids.add(q.questionid);
      return true;
    });

    const legacyOptions = (tableMap.get('options') ?? []) as LegacyOption[];
    const legacySubjects = (tableMap.get('subject') ?? []) as LegacySubject[];
    const legacyTopics = (tableMap.get('topics') ?? []) as LegacyTopic[];

    console.log(
      `    Loaded: ${legacyQuestions.length} questions (${allLegacyQuestions.length - legacyQuestions.length} dupes dropped), ` +
        `${legacyOptions.length} options, ${legacyTopics.length} topics`,
    );

    // ── Build new-schema lookup maps ───────────────────────────────────────
    const etsRepo = dataSource.getRepository(ExamTypeSubject);
    const topicRepo = dataSource.getRepository(Topic);
    const questionRepo = dataSource.getRepository(Question);

    const allEts = await etsRepo.find({ relations: ['subject', 'examType'] });
    // "JAMB::Chemistry" → ExamTypeSubject
    const etsByKey = new Map<string, ExamTypeSubject>();
    for (const ets of allEts) {
      etsByKey.set(`${ets.examType.name}::${ets.subject.name}`, ets);
    }

    // subjectName → all ETS records from WAEC/NECO/GCE for that subject
    // Used to cross-link shared questions to all three exam types at once.
    const sharedEtsBySubject = new Map<string, ExamTypeSubject[]>();
    for (const ets of allEts) {
      if (!SHARED_EXAM_TYPES.has(ets.examType.name)) continue;
      const list = sharedEtsBySubject.get(ets.subject.name) ?? [];
      list.push(ets);
      sharedEtsBySubject.set(ets.subject.name, list);
    }

    // ── Map legacy subjectId → ExamTypeSubject ─────────────────────────────
    const relevantSubjects = legacySubjects.filter((s) =>
      Object.keys(COURSE_TO_EXAM_TYPE).includes(s.course),
    );
    const subjectToEts = new Map<string, ExamTypeSubject>();
    for (const legSub of relevantSubjects) {
      const examTypeName = COURSE_TO_EXAM_TYPE[legSub.course];
      if (!examTypeName) continue;
      const newName =
        SUBJECT_NAME_MAP[legSub.title.trim().toLowerCase()] ??
        legSub.title.trim();
      const ets = etsByKey.get(`${examTypeName}::${newName}`);
      if (ets) subjectToEts.set(legSub.id, ets);
    }

    // ── Build options lookup: legacyQuestionId → options ──────────────────
    const optionsByQuestionId = new Map<string, LegacyOption[]>();
    for (const opt of legacyOptions) {
      const list = optionsByQuestionId.get(opt.questionid) ?? [];
      list.push(opt);
      optionsByQuestionId.set(opt.questionid, list);
    }

    // ── Legacy topics index ────────────────────────────────────────────────
    const legacyTopicById = new Map<string, LegacyTopic>();
    for (const t of legacyTopics) legacyTopicById.set(t.id, t);

    const topicCache = new Map<string, string>();

    async function resolveTopicId(
      legTopicId: string,
      subjectId: string,
    ): Promise<string | null> {
      const legTopic = legacyTopicById.get(legTopicId);
      if (!legTopic?.topic?.trim()) return null;

      const topicName = legTopic.topic.trim();
      const cacheKey = `${subjectId}::${topicName}`;
      if (topicCache.has(cacheKey)) return topicCache.get(cacheKey)!;

      let topic = await topicRepo.findOne({
        where: { subjectId, name: topicName },
      });
      if (!topic) {
        topic = await topicRepo.save(
          topicRepo.create({
            subjectId,
            name: topicName,
            content: htmlToMd(legTopic.dcp) || '',
            isActive: true,
          }),
        );
      }
      topicCache.set(cacheKey, topic.id);
      return topic.id;
    }

    // ── Idempotency: load existing legacyIds ───────────────────────────────
    const existingRows = await questionRepo
      .createQueryBuilder('q')
      .select('q.legacyId', 'legacyId')
      .where('q.legacyId IS NOT NULL')
      .getRawMany<{ legacyId: string }>();
    const importedLegacyIds = new Set(existingRows.map((r) => r.legacyId));
    console.log(`    Already imported: ${importedLegacyIds.size} questions`);

    // ── Pre-build content hash map from existing DB questions ─────────────
    // Needed for safe re-runs: existing WAEC questions are canonical; we
    // detect them by hash so NECO/GCE duplicates don't create new records.
    const contentHashMap = new Map<string, { id: string }>();
    if (importedLegacyIds.size > 0) {
      const existingShared = await dataSource.query<
        Array<{ id: string; questionText: string; subjectName: string }>
      >(`
        SELECT DISTINCT q.id, q."questionText", s.name AS "subjectName"
        FROM questions q
        INNER JOIN question_exam_type_subjects qets ON qets."questionId" = q.id
        INNER JOIN exam_type_subjects ets ON ets.id = qets."examTypeSubjectId"
        INNER JOIN subjects s ON s.id = ets."subjectId"
        INNER JOIN exam_types et ON et.id = ets."examTypeId"
        WHERE et.name IN ('WAEC', 'NECO', 'GCE')
      `);
      for (const row of existingShared) {
        const h = contentHash(row.subjectName, row.questionText);
        if (!contentHashMap.has(h)) contentHashMap.set(h, { id: row.id });
      }
      console.log(
        `    Pre-loaded ${contentHashMap.size} content hashes from existing questions`,
      );
    }

    // Helper: insert into join table (idempotent)
    async function linkToEts(questionId: string, etsId: string): Promise<void> {
      await dataSource.query(
        `INSERT INTO question_exam_type_subjects ("questionId", "examTypeSubjectId")
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [questionId, etsId],
      );
    }

    // ── Group legacy questions by exam type for ordered processing ─────────
    const questionsByExamType = new Map<string, LegacyQuestion[]>();
    for (const examTypeName of PROCESS_ORDER) {
      questionsByExamType.set(examTypeName, []);
    }
    for (const legQ of legacyQuestions) {
      const examTypeName = COURSE_TO_EXAM_TYPE[legQ.course];
      if (examTypeName) {
        const arr = questionsByExamType.get(examTypeName) ?? [];
        arr.push(legQ);
        questionsByExamType.set(examTypeName, arr);
      }
    }

    // ── Main import loop (ordered: WAEC → NECO → GCE → JAMB → POST-JAMB) ──
    let imported = 0;
    let crossLinked = 0;
    let skipped = 0;
    let noEts = 0;
    let noOptions = 0;
    // In-memory set to handle within-run dedup of NECO/GCE legacy IDs
    const seenThisRun = new Set(importedLegacyIds);

    for (const examTypeName of PROCESS_ORDER) {
      const isShared = SHARED_EXAM_TYPES.has(examTypeName);
      const questionsForType = questionsByExamType.get(examTypeName) ?? [];

      for (const legQ of questionsForType) {
        if (seenThisRun.has(legQ.questionid)) {
          skipped++;
          continue;
        }

        const ets = subjectToEts.get(legQ.subject);
        if (!ets) {
          noEts++;
          continue;
        }

        const typeMapping =
          QUESTION_TYPE_MAP[legQ.question_type] ??
          QUESTION_TYPE_MAP['Objective'];
        const { type, category } = typeMapping;

        const rawOpts = optionsByQuestionId.get(legQ.questionid) ?? [];
        let options:
          | Array<{ id: string; text: string; isCorrect: boolean }>
          | undefined;
        let correctAnswer: string | string[] | null = null;

        if (type === QuestionType.MULTIPLE_CHOICE) {
          if (rawOpts.length === 0) {
            noOptions++;
            continue;
          }
          options = rawOpts.map((o, i) => ({
            id: String.fromCharCode(65 + i),
            text: htmlToMd(o.questions_options),
            isCorrect: o.answer === '1',
          }));
          const hasContent = options.some((o) => o.text.trim().length > 0);
          if (!hasContent) {
            noOptions++;
            continue;
          }
          const correctIds = options
            .filter((o) => o.isCorrect)
            .map((o) => o.id);
          correctAnswer =
            correctIds.length === 1
              ? correctIds[0]
              : correctIds.length > 1
                ? correctIds
                : null;
        }

        const questionText = htmlToMd(legQ.question);
        if (!questionText) {
          skipped++;
          continue;
        }

        const subjectName = ets.subject.name;

        // ── Shared exam types (WAEC/NECO/GCE): content-hash dedup ─────────
        if (isShared) {
          const h = contentHash(subjectName, questionText);

          if (contentHashMap.has(h)) {
            // Duplicate of an existing question — add ETS link only
            const existing = contentHashMap.get(h)!;
            await linkToEts(existing.id, ets.id);
            seenThisRun.add(legQ.questionid);
            crossLinked++;
            continue;
          }

          // New canonical question — create it, then link to ALL shared ETS
          // for this subject (WAEC + NECO + GCE) so students of any of the
          // three exam types see it.
          let topicId: string | undefined;
          if (legQ.topic && legQ.topic !== '0') {
            topicId =
              (await resolveTopicId(legQ.topic, ets.subjectId)) ?? undefined;
          }

          // Only WAEC questions get legacyId (canonical record). Unique
          // NECO/GCE questions also get their own legacyId for re-run safety.
          const q = questionRepo.create({
            topicId,
            questionText,
            options,
            type,
            category,
            correctAnswer: correctAnswer ?? undefined,
            explanation: htmlToMd(legQ.answer_description) || undefined,
            difficulty: 'medium',
            marks: 1,
            isActive: true,
            timesAttempted: 0,
            timesCorrect: 0,
            legacyId: legQ.questionid,
          });
          await questionRepo.save(q);

          // Link to every ETS that has this subject across WAEC/NECO/GCE
          const allShared = sharedEtsBySubject.get(subjectName) ?? [ets];
          for (const sharedEts of allShared) {
            await linkToEts(q.id, sharedEts.id);
          }

          contentHashMap.set(h, { id: q.id });
          seenThisRun.add(legQ.questionid);
          imported++;
        } else {
          // ── Non-shared (JAMB / POST-JAMB): link only to their own ETS ────
          let topicId: string | undefined;
          if (legQ.topic && legQ.topic !== '0') {
            topicId =
              (await resolveTopicId(legQ.topic, ets.subjectId)) ?? undefined;
          }

          const q = questionRepo.create({
            topicId,
            questionText,
            options,
            type,
            category,
            correctAnswer: correctAnswer ?? undefined,
            explanation: htmlToMd(legQ.answer_description) || undefined,
            difficulty: 'medium',
            marks: 1,
            isActive: true,
            timesAttempted: 0,
            timesCorrect: 0,
            legacyId: legQ.questionid,
          });
          await questionRepo.save(q);
          await linkToEts(q.id, ets.id);

          seenThisRun.add(legQ.questionid);
          imported++;
        }

        if ((imported + crossLinked) % 500 === 0) {
          process.stdout.write(`    Processed ${imported + crossLinked}...\r`);
        }
      }
    }

    console.log(`\n`);
    console.log(`    ✅ Imported:      ${imported} (new question records)`);
    console.log(
      `    🔗 Cross-linked:  ${crossLinked} (NECO/GCE dupes reused WAEC record)`,
    );
    console.log(
      `    ⏭  Skipped:       ${skipped} (already in DB or empty text)`,
    );
    console.log(`    ⚠  No ETS:        ${noEts} (subject not in new schema)`);
    console.log(
      `    ⚠  No options:    ${noOptions} (Objective with no options)`,
    );

    // ── Update Subject.totalQuestions counters ─────────────────────────────
    if (imported > 0 || crossLinked > 0) {
      console.log('    Updating Subject.totalQuestions counters...');
      const subjectRepo = dataSource.getRepository(Subject);
      const subjects = await subjectRepo.find();
      for (const subj of subjects) {
        const [row] = await dataSource.query<Array<{ count: string }>>(
          `SELECT COUNT(DISTINCT q.id)::int AS count
           FROM questions q
           INNER JOIN question_exam_type_subjects qets ON qets."questionId" = q.id
           INNER JOIN exam_type_subjects ets ON ets.id = qets."examTypeSubjectId"
           WHERE ets."subjectId" = $1 AND q."isActive" = true`,
          [subj.id],
        );
        const count = parseInt(row?.count ?? '0', 10);
        if (subj.totalQuestions !== count) {
          await subjectRepo.update(subj.id, { totalQuestions: count });
        }
      }
    }
  },
};
