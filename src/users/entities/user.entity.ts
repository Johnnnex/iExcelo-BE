import { Entity, Column, OneToMany, OneToOne } from 'typeorm';
import { RefreshToken } from '../../auth/entities/refresh-tokens.entity';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { SponsorProfile } from '../../sponsors/entities/sponsor-profile.entity';
import { AffiliateProfile } from '../../affiliates/entities/affiliate-profile.entity';
import { AffiliateReferral } from '../../affiliates/entities/affiliate-referral.entity';
import { AuthProvider, UserType } from '../../../types';
import { BaseEntity } from '../../common/entities';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password: string;

  @Column()
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ nullable: true })
  countryCode: string;

  @Column({ nullable: true })
  picture: string;

  @Column({ type: 'enum', enum: Object.values(UserType), nullable: true })
  role: UserType;

  @Column({
    type: 'enum',
    enum: Object.values(AuthProvider),
    default: AuthProvider.LOCAL,
  })
  provider: AuthProvider;

  @Column({ nullable: true })
  googleId: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ default: true })
  isActive: boolean; // To track other metadata, maybe if an admin decides to ban a user

  @Column({ type: 'timestamp', nullable: true })
  lastLogin: Date;

  // Relations
  @OneToMany(() => RefreshToken, (token: RefreshToken) => token.user)
  refreshTokens: RefreshToken[];

  @OneToOne(() => StudentProfile, (profile: StudentProfile) => profile.user, {
    nullable: true,
  })
  studentProfile: StudentProfile;

  @OneToOne(() => SponsorProfile, (profile: SponsorProfile) => profile.user, {
    nullable: true,
  })
  sponsorProfile: SponsorProfile;

  @OneToOne(
    () => AffiliateProfile,
    (profile: AffiliateProfile) => profile.user,
    {
      nullable: true,
    },
  )
  affiliateProfile: AffiliateProfile;

  // ONE user has ONE referral record (optional - they might not be referred)
  @OneToOne(
    () => AffiliateReferral,
    (referral: AffiliateReferral) => referral.referredUser,
    {
      nullable: true,
    },
  )
  referredBy: AffiliateReferral;
}
