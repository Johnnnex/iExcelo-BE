import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { SponsorProfile } from './sponsor-profile.entity';
import { BaseEntity } from '../../common/entities';

@Entity('sponsor_urls')
@Index(['code'], { unique: true })
@Index(['sponsorId'])
export class SponsorUrl extends BaseEntity {
  @Column()
  sponsorId: string;

  @Column()
  label: string; // e.g. "Unity School Batch 1", "Cousins Group"

  @Column({ unique: true })
  code: string; // Random unique code — used in /signup/s/:code

  @Column({ nullable: true, type: 'int' })
  maxUses: number | null; // null = unlimited

  @Column({ type: 'int', default: 0 })
  usedCount: number;

  @Column({ default: false })
  isDisabled: boolean; // Sponsor can disable a URL to stop new signups

  // Relations
  @ManyToOne(() => SponsorProfile, (profile) => profile.sponsorUrls, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sponsorId' })
  sponsor: SponsorProfile;
}
