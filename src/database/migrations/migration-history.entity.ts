import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities';

@Entity('migration_history')
export class MigrationHistory extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column()
  ranAt: Date;

  @Column({ nullable: true })
  durationMs: number;

  @Column({ type: 'text', nullable: true })
  error: string;
}
