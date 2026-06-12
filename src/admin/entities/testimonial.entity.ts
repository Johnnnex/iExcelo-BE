import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { User } from '../../users/entities/user.entity';

@Entity('testimonials')
@Index(['isPublished'])
@Index(['displayOrder'])
export class Testimonial extends BaseEntity {
  @Column({ nullable: true })
  userId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  role: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'int', default: 5 })
  rating: number;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
