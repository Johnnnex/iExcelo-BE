import { DataSource } from 'typeorm';
import { IMigration } from '../migration-runner';
import { ExamType } from '../../../exams/entities/exam-type.entity';
import { Subject } from '../../../exams/entities/subject.entity';
import { ExamTypeSubject } from '../../../exams/entities/exam-type-subject.entity';
import { Topic } from '../../../exams/entities/topic.entity';
import { ExamConfig } from '../../../exams/entities/exam-config.entity';
import { examTypesData } from '../../../exams/data/exam-types.data';
import { subjectsData } from '../../../exams/data/subjects.data';
import { topicsSeedData } from '../../../exams/data/topics.seed';
import { examConfigsSeedData } from '../../../exams/data/exam-configs.data';

export const migration002: IMigration = {
  name: '002-seed-exam-types',
  description:
    'Seeds ExamTypes, Subjects, ExamTypeSubjects, Topics, and ExamConfigs',

  async run(dataSource: DataSource): Promise<void> {
    const examTypeRepo = dataSource.getRepository(ExamType);
    const subjectRepo = dataSource.getRepository(Subject);
    const etsRepo = dataSource.getRepository(ExamTypeSubject);
    const topicRepo = dataSource.getRepository(Topic);
    const configRepo = dataSource.getRepository(ExamConfig);

    // ── 1. ExamTypes ───────────────────────────────────────────────────────
    console.log('    Seeding exam types...');
    const examTypeMap = new Map<string, ExamType>();

    for (const data of examTypesData) {
      let et = await examTypeRepo.findOne({ where: { name: data.name } });
      if (!et) {
        et = await examTypeRepo.save(examTypeRepo.create(data));
        console.log(`      + ExamType: ${data.name}`);
      } else {
        // Keep metadata in sync
        await examTypeRepo.update(et.id, {
          freeTierQuestionLimit: data.freeTierQuestionLimit,
          supportedCategories: data.supportedCategories,
          minSubjectsSelectable: data.minSubjectsSelectable,
          maxSubjectsSelectable: data.maxSubjectsSelectable,
        });
      }
      examTypeMap.set(data.name, et);
    }

    // ── 2. Subjects + ExamTypeSubjects ─────────────────────────────────────
    console.log('    Seeding subjects...');
    // "JAMB::Mathematics" → subjectId
    const subjectIdMap = new Map<string, string>();

    for (const data of subjectsData) {
      const examType = examTypeMap.get(data.examTypeName);
      if (!examType) continue;

      // Check if ExamTypeSubject already exists for this (examType, subjectName) pair
      const existingEts = await etsRepo
        .createQueryBuilder('ets')
        .innerJoin('ets.subject', 's')
        .where('ets.examTypeId = :etId', { etId: examType.id })
        .andWhere('s.name = :name', { name: data.name })
        .getOne();

      if (existingEts) {
        subjectIdMap.set(
          `${data.examTypeName}::${data.name}`,
          existingEts.subjectId,
        );
        continue;
      }

      const subject = await subjectRepo.save(
        subjectRepo.create({ name: data.name, description: data.description }),
      );
      await etsRepo.save(
        etsRepo.create({ examTypeId: examType.id, subjectId: subject.id }),
      );
      subjectIdMap.set(`${data.examTypeName}::${data.name}`, subject.id);
      console.log(`      + Subject: ${data.examTypeName} / ${data.name}`);
    }

    // ── 3. Topics ──────────────────────────────────────────────────────────
    console.log('    Seeding topics...');
    let topicsInserted = 0;

    for (const seed of topicsSeedData) {
      const subjectId = subjectIdMap.get(
        `${seed.examTypeName}::${seed.subjectName}`,
      );
      if (!subjectId) continue;

      const existing = await topicRepo.findOne({
        where: { subjectId, name: seed.name },
      });

      if (existing) {
        if (existing.content !== seed.content) {
          await topicRepo.update(existing.id, { content: seed.content });
        }
        continue;
      }

      await topicRepo.save(
        topicRepo.create({ subjectId, name: seed.name, content: seed.content }),
      );
      topicsInserted++;
    }
    console.log(`      + ${topicsInserted} topics inserted`);

    // ── 4. ExamConfigs ─────────────────────────────────────────────────────
    console.log('    Seeding exam configs...');
    for (const seed of examConfigsSeedData) {
      const examType = examTypeMap.get(seed.examTypeName);
      if (!examType) continue;

      const existing = await configRepo.findOne({
        where: { examTypeId: examType.id, mode: seed.mode },
      });

      if (existing) {
        await configRepo.update(existing.id, {
          standardDurationMinutes: seed.standardDurationMinutes ?? undefined,
          standardQuestionCount: seed.standardQuestionCount ?? undefined,
          rules: seed.rules ?? undefined,
        });
      } else {
        await configRepo.save(
          configRepo.create({
            examTypeId: examType.id,
            mode: seed.mode,
            standardDurationMinutes: seed.standardDurationMinutes ?? undefined,
            standardQuestionCount: seed.standardQuestionCount ?? undefined,
            rules: seed.rules ?? undefined,
          }),
        );
        console.log(`      + ExamConfig: ${seed.examTypeName} / ${seed.mode}`);
      }
    }
  },
};
