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

// ─── HTML → Markdown converter ────────────────────────────────────────────────
function buildTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
  });

  // MathJax span.math-tex: \(expr\) → $expr$, \[expr\] → $$expr$$
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

  // Strip noisy style spans — return inner content only
  td.addRule('strip-style-spans', {
    filter: (node: HTMLElement) =>
      node.nodeName === 'SPAN' &&
      !!node.getAttribute('style') &&
      !node.className?.includes('math-tex'),
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
    'Imports 15,579 legacy questions from "Previous Site Data.json" (HTML→Markdown)',

  async run(dataSource: DataSource): Promise<void> {
    // ── Ensure legacyId column exists (safe to re-run) ─────────────────────
    await dataSource.query(
      `ALTER TABLE questions ADD COLUMN IF NOT EXISTS "legacyId" varchar UNIQUE`,
    );

    // ── Load legacy JSON ───────────────────────────────────────────────────
    // File lives at project root: iExcelo/Previous Site Data.json
    // This script is at: iExcelo/Backend/src/database/migrations/scripts/
    const jsonPath = path.resolve(
      __dirname,
      '../../../../../../Previous Site Data.json',
    );
    if (!fs.existsSync(jsonPath)) {
      throw new Error(
        `Legacy data file not found at: ${jsonPath}\n` +
          `  Expected: iExcelo/Previous Site Data.json`,
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
      if (entry.type === 'table') {
        tableMap.set(entry.name, entry.data);
      }
    }

    const legacyQuestions = (tableMap.get('questions') ??
      []) as LegacyQuestion[];
    const legacyOptions = (tableMap.get('options') ?? []) as LegacyOption[];
    const legacySubjects = (tableMap.get('subject') ?? []) as LegacySubject[];
    const legacyTopics = (tableMap.get('topics') ?? []) as LegacyTopic[];

    console.log(
      `    Loaded: ${legacyQuestions.length} questions, ${legacyOptions.length} options, ` +
        `${legacyTopics.length} topics`,
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

    // ── Map legacy subjectId → ExamTypeSubject in new schema ──────────────
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

    // Cache: "subjectId::topicName" → Topic.id UUID
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

    // ── Idempotency: find already-imported legacyIds ───────────────────────
    const existingRows = await questionRepo
      .createQueryBuilder('q')
      .select('q.legacyId', 'legacyId')
      .where('q.legacyId IS NOT NULL')
      .getRawMany<{ legacyId: string }>();
    const importedIds = new Set(existingRows.map((r) => r.legacyId));
    console.log(`    Already imported: ${importedIds.size} questions`);

    // ── Main import loop ───────────────────────────────────────────────────
    let imported = 0;
    let skipped = 0;
    let noEts = 0;
    let noOptions = 0;

    for (const legQ of legacyQuestions) {
      // Idempotency
      if (importedIds.has(legQ.questionid)) {
        skipped++;
        continue;
      }

      // Resolve ExamTypeSubject
      const ets = subjectToEts.get(legQ.subject);
      if (!ets) {
        noEts++;
        continue;
      }

      // Determine question type
      const typeMapping =
        QUESTION_TYPE_MAP[legQ.question_type] ?? QUESTION_TYPE_MAP['Objective'];
      const { type, category } = typeMapping;

      // Build options (Objective questions only)
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
          id: String.fromCharCode(65 + i), // A, B, C, D...
          text: htmlToMd(o.questions_options),
          isCorrect: o.answer === '1',
        }));
        const correctIds = options.filter((o) => o.isCorrect).map((o) => o.id);
        correctAnswer =
          correctIds.length === 1
            ? correctIds[0]
            : correctIds.length > 1
              ? correctIds
              : null;
      }

      // Convert HTML content
      const questionText = htmlToMd(legQ.question);
      if (!questionText) {
        skipped++;
        continue;
      }

      // Resolve topic (optional)
      let topicId: string | undefined;
      if (legQ.topic && legQ.topic !== '0') {
        topicId =
          (await resolveTopicId(legQ.topic, ets.subjectId)) ?? undefined;
      }

      // Save
      const q = questionRepo.create({
        examTypeSubjectId: ets.id,
        topicId,
        questionText,
        options,
        type,
        category,
        correctAnswer: correctAnswer ?? undefined,
        explanationShort: htmlToMd(legQ.answer_description) || undefined,
        difficulty: 'medium',
        marks: 1,
        isActive: true,
        timesAttempted: 0,
        timesCorrect: 0,
        legacyId: legQ.questionid,
      });
      await questionRepo.save(q);
      imported++;

      if (imported % 500 === 0) {
        process.stdout.write(`    Imported ${imported}...\r`);
      }
    }

    console.log(`\n`);
    console.log(`    ✅ Imported:   ${imported}`);
    console.log(`    ⏭  Skipped:    ${skipped} (already in DB or empty text)`);
    console.log(`    ⚠  No ETS:     ${noEts} (subject not in new schema)`);
    console.log(`    ⚠  No options: ${noOptions} (Objective with no options)`);

    // ── Update Subject.totalQuestions counters ─────────────────────────────
    if (imported > 0) {
      console.log('    Updating Subject.totalQuestions counters...');
      const subjectRepo = dataSource.getRepository(Subject);
      const subjects = await subjectRepo.find();
      for (const subj of subjects) {
        const count = await questionRepo
          .createQueryBuilder('q')
          .innerJoin('q.examTypeSubject', 'ets')
          .where('ets.subjectId = :subjectId', { subjectId: subj.id })
          .andWhere('q.isActive = true')
          .getCount();
        if (subj.totalQuestions !== count) {
          await subjectRepo.update(subj.id, { totalQuestions: count });
        }
      }
    }
  },
};
