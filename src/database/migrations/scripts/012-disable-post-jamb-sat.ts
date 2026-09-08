import { DataSource } from 'typeorm';
import { IMigration } from '../migration-runner';

export const migration012: IMigration = {
  name: '012-disable-post-jamb-sat',
  description:
    'Deactivates POST-JAMB and SAT exam types; removes their ExamTypeSubject links. Subjects remain for future wiring from admin dashboard.',
  async run(dataSource: DataSource): Promise<void> {
    // Deactivate POST-JAMB and SAT exam types
    await dataSource.query(`
      UPDATE exam_types
         SET "isActive" = false
       WHERE name IN ('POST-JAMB', 'SAT')
    `);

    // Delete ExamTypeSubject links for POST-JAMB and SAT
    // Subject rows are preserved — only the ETS links are removed.
    await dataSource.query(`
      DELETE FROM exam_type_subjects
       WHERE "examTypeId" IN (
         SELECT id FROM exam_types WHERE name IN ('POST-JAMB', 'SAT')
       )
    `);

    console.log('    POST-JAMB and SAT exam types deactivated; ETS links removed.');
  },
};
