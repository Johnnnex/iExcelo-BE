import { Entity, Column, OneToMany } from 'typeorm';
import { ExamTypeSubject } from './exam-type-subject.entity';
import { ExamConfig } from './exam-config.entity';
import { BaseEntity } from '../../common/entities';
import { Subscription } from '../../subscriptions/entities';
import { QuestionCategory } from '../../../types';

@Entity('exam_types')
export class ExamType extends BaseEntity {
  @Column({ unique: true })
  name: string; // JAMB/UTME, WAEC, NECO, POST-UTME, GCE, K2-SAT

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  minSubjectsSelectable: number; // Minimum subjects required (e.g., 4 for JAMB)

  @Column()
  maxSubjectsSelectable: number; // 4 for JAMB, 12 for WAEC etc...

  @Column({ default: 50 })
  freeTierQuestionLimit: number;

  // Which question categories this exam type uses.
  // JAMB → ['objectives']
  // WAEC / NECO / GCE → ['objectives', 'theory', 'practical']
  @Column({ type: 'json', default: () => '\'["objectives"]\'' })
  supportedCategories: QuestionCategory[];

  @Column({ default: true })
  isActive: boolean;

  // ─── Relations ─────────────────────────────────────────────────────────

  @OneToMany(() => ExamTypeSubject, (ets) => ets.examType)
  examTypeSubjects: ExamTypeSubject[];

  @OneToMany(() => Subscription, (sub) => sub.examType)
  subscriptions: Subscription[];

  @OneToMany(() => ExamConfig, (config) => config.examType)
  configs: ExamConfig[];
}
