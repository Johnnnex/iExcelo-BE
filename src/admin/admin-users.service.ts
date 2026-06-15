import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { SponsorProfile } from '../sponsors/entities/sponsor-profile.entity';
import { AffiliateProfile } from '../affiliates/entities/affiliate-profile.entity';
import { AffiliatePayout } from '../affiliates/entities/affiliate-payout.entity';
import { User } from '../users/entities/user.entity';
import { PasswordResetToken } from '../auth/entities/password-reset-tokens.entity';
import { EMAILS_QUEUE, EmailJobs } from '../email/queue/email.queue';
import { PayoutStatus } from '../../types';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(StudentProfile)
    private studentProfileRepo: Repository<StudentProfile>,
    @InjectRepository(SponsorProfile)
    private sponsorProfileRepo: Repository<SponsorProfile>,
    @InjectRepository(AffiliateProfile)
    private affiliateProfileRepo: Repository<AffiliateProfile>,
    @InjectRepository(AffiliatePayout)
    private affiliatePayoutRepo: Repository<AffiliatePayout>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private passwordResetTokenRepo: Repository<PasswordResetToken>,
    @InjectQueue(EMAILS_QUEUE) private readonly emailQueue: Queue,
  ) {}

  // ─── Students ──────────────────────────────────────────────────────────────

  async listStudents(limit: number, search?: string, cursor?: string) {
    const qb = this.studentProfileRepo
      .createQueryBuilder('sp')
      .leftJoinAndSelect('sp.user', 'u')
      .orderBy('sp.createdAt', 'DESC')
      .addOrderBy('sp.id', 'DESC')
      .take(limit + 1);

    if (cursor) {
      qb.andWhere(
        `(sp.createdAt < :cur OR (sp.createdAt = :cur AND sp.id < :curId))`,
        {
          cur: new Date(cursor.split('__')[0]),
          curId: cursor.split('__')[1] ?? '',
        },
      );
    }

    if (search) {
      qb.andWhere(
        `(u.firstName ILIKE :s OR u.lastName ILIKE :s OR u.email ILIKE :s)`,
        { s: `%${search}%` },
      );
    }

    const items = await qb.getMany();
    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last ? `${last.createdAt.toISOString()}__${last.id}` : null;

    return { items, nextCursor, hasMore };
  }

  async resetStudentPassword(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const tokenString = crypto.randomBytes(64).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(tokenString)
      .digest('hex');

    const resetToken = this.passwordResetTokenRepo.create({
      token: hashedToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await this.passwordResetTokenRepo.save(resetToken);

    await this.emailQueue.add(
      EmailJobs.SEND_PASSWORD_RESET,
      { email: user.email, resetToken: tokenString },
      { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
    );

    return { message: 'Password reset email sent' };
  }

  async deactivateStudent(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = false;
    await this.userRepo.save(user);
    return { message: 'Student deactivated' };
  }

  async reactivateStudent(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = true;
    await this.userRepo.save(user);
    return { message: 'Student reactivated' };
  }

  async suspendStudent(userId: string, suspendedUntil: Date) {
    if (suspendedUntil <= new Date()) {
      throw new BadRequestException('suspendedUntil must be in the future');
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.suspendedUntil = suspendedUntil;
    await this.userRepo.save(user);
    return { message: 'Student suspended' };
  }

  async unsuspendStudent(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.suspendedUntil = null;
    await this.userRepo.save(user);
    return { message: 'Suspension lifted' };
  }

  // ─── Sponsors ──────────────────────────────────────────────────────────────

  async listSponsors(limit: number, search?: string, cursor?: string) {
    const qb = this.sponsorProfileRepo
      .createQueryBuilder('sp')
      .leftJoinAndSelect('sp.user', 'u')
      .orderBy('sp.createdAt', 'DESC')
      .addOrderBy('sp.id', 'DESC')
      .take(limit + 1);

    if (cursor) {
      qb.andWhere(
        `(sp.createdAt < :cur OR (sp.createdAt = :cur AND sp.id < :curId))`,
        {
          cur: new Date(cursor.split('__')[0]),
          curId: cursor.split('__')[1] ?? '',
        },
      );
    }

    if (search) {
      qb.andWhere(
        `(u.firstName ILIKE :s OR u.lastName ILIKE :s OR u.email ILIKE :s OR sp.companyName ILIKE :s)`,
        { s: `%${search}%` },
      );
    }

    const items = await qb.getMany();
    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last ? `${last.createdAt.toISOString()}__${last.id}` : null;

    return { items, nextCursor, hasMore };
  }

  async sendSponsorPasswordReset(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const tokenString = crypto.randomBytes(64).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(tokenString)
      .digest('hex');

    const resetToken = this.passwordResetTokenRepo.create({
      token: hashedToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await this.passwordResetTokenRepo.save(resetToken);

    await this.emailQueue.add(
      EmailJobs.SEND_PASSWORD_RESET,
      { email: user.email, resetToken: tokenString },
      { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
    );

    return { message: 'Password reset email sent' };
  }

  async deactivateSponsor(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = false;
    await this.userRepo.save(user);
    return { message: 'Sponsor deactivated' };
  }

  async reactivateSponsor(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = true;
    await this.userRepo.save(user);
    return { message: 'Sponsor reactivated' };
  }

  // ─── Affiliates ────────────────────────────────────────────────────────────

  async listAffiliates(limit: number, search?: string, cursor?: string) {
    const qb = this.affiliateProfileRepo
      .createQueryBuilder('ap')
      .leftJoinAndSelect('ap.user', 'u')
      .orderBy('ap.createdAt', 'DESC')
      .addOrderBy('ap.id', 'DESC')
      .take(limit + 1);

    if (cursor) {
      qb.andWhere(
        `(ap.createdAt < :cur OR (ap.createdAt = :cur AND ap.id < :curId))`,
        {
          cur: new Date(cursor.split('__')[0]),
          curId: cursor.split('__')[1] ?? '',
        },
      );
    }

    if (search) {
      qb.andWhere(
        `(u.firstName ILIKE :s OR u.lastName ILIKE :s OR u.email ILIKE :s OR ap.affiliateCode ILIKE :s)`,
        { s: `%${search}%` },
      );
    }

    const items = await qb.getMany();
    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last ? `${last.createdAt.toISOString()}__${last.id}` : null;

    return { items, nextCursor, hasMore };
  }

  async deactivateAffiliate(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = false;
    await this.userRepo.save(user);
    return { message: 'Affiliate deactivated' };
  }

  async reactivateAffiliate(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = true;
    await this.userRepo.save(user);
    return { message: 'Affiliate reactivated' };
  }

  async listPayouts(affiliateId: string, page: number, limit: number) {
    const [items, total] = await this.affiliatePayoutRepo.findAndCount({
      where: { affiliateId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page };
  }

  async approvePayout(payoutId: string) {
    const payout = await this.affiliatePayoutRepo.findOne({
      where: { id: payoutId },
    });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException('Only pending payouts can be approved');
    }
    payout.status = PayoutStatus.COMPLETED;
    payout.processedAt = new Date();
    await this.affiliatePayoutRepo.save(payout);

    // Reflect in profile
    const profile = await this.affiliateProfileRepo.findOne({
      where: { id: payout.affiliateId },
    });
    if (profile) {
      profile.pendingBalance = Math.max(
        0,
        profile.pendingBalance - payout.amount,
      );
      profile.totalPaidOut += payout.amount;
      await this.affiliateProfileRepo.save(profile);
    }

    return { message: 'Payout approved' };
  }

  async rejectPayout(payoutId: string, reason: string) {
    const payout = await this.affiliatePayoutRepo.findOne({
      where: { id: payoutId },
    });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException('Only pending payouts can be rejected');
    }
    payout.status = PayoutStatus.FAILED;
    payout.failureReason = reason;
    payout.processedAt = new Date();
    await this.affiliatePayoutRepo.save(payout);
    return { message: 'Payout rejected' };
  }
}
