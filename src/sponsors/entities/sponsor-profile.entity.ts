import { Entity, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Sponsorship } from './sponsorship.entity';
import { Donation } from './donation.entity';
import { SponsorUrl } from './sponsor-url.entity';
import { SponsorStudentInvite } from './sponsor-student-invite.entity';
import { Giveback } from './giveback.entity';
import { Transaction } from '../../subscriptions/entities';
import { BaseEntity } from '../../common/entities';
import { SponsorType } from '../../../types';

@Entity('sponsor_profiles')
export class SponsorProfile extends BaseEntity {
  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: Object.values(SponsorType),
    default: SponsorType.INDIVIDUAL,
  })
  sponsorType: SponsorType;

  @Column({ nullable: true })
  companyName: string;

  @Column({ default: 0 })
  totalStudentsSponsored: number;

  @Column({ type: 'float', default: 0 })
  totalAmountDonated: number;

  // Relations
  @OneToOne(() => User, (user) => user.sponsorProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Sponsorship, (sponsorship) => sponsorship.sponsor)
  sponsorships: Sponsorship[];

  @OneToMany(() => Donation, (donation) => donation.sponsor)
  donations: Donation[];

  @OneToMany(() => Transaction, (transaction) => transaction.sponsor)
  transactions: Transaction[];

  @OneToMany(() => SponsorUrl, (url) => url.sponsor)
  sponsorUrls: SponsorUrl[];

  @OneToMany(() => SponsorStudentInvite, (invite) => invite.sponsor)
  studentInvites: SponsorStudentInvite[];

  @OneToMany(() => Giveback, (giveback) => giveback.sponsor)
  givebacks: Giveback[];
}
