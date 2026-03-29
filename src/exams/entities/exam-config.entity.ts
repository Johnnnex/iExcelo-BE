import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ExamType } from './exam-type.entity';
import { ExamConfigModes } from '../../../types';
import { BaseEntity } from '../../common/entities';

@Entity('exam_configs')
export class ExamConfig extends BaseEntity {
  @Column()
  examTypeId: string;

  @Column({ type: 'enum', enum: Object.values(ExamConfigModes) })
  mode: string;

  @Column({ nullable: true }) // For mock mode
  standardDurationMinutes: number;

  @Column({ nullable: true }) // For mock mode
  standardQuestionCount: number;

  @Column({ type: 'json', nullable: true })
  rules: any; // Exam-specific rules

  // Relations
  @ManyToOne(() => ExamType, (examType) => examType.configs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'examTypeId' })
  examType: ExamType;
}
