import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { StudentExamType } from './student-exam-type.entity';
import { Subject } from '../../exams/entities/subject.entity';
import { BaseEntity } from '../../common/entities';

@Entity('student_exam_type_subjects')
@Index(['studentExamTypeId', 'subjectId'], { unique: true })
export class StudentExamTypeSubject extends BaseEntity {
  @Column()
  studentExamTypeId: string;

  @Column()
  subjectId: string;

  // Relations
  @ManyToOne(() => StudentExamType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentExamTypeId' })
  studentExamType: StudentExamType;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subjectId' })
  subject: Subject;
}
