import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AdminProfile } from './entities/admin-profile.entity';
import { AdminRole, ModulePermissionsMap } from './entities/admin-role.entity';
import { AdminInvite, AdminInviteStatus } from './entities/admin-invite.entity';
import { User } from '../users/entities/user.entity';
import { Question } from '../exams/entities/question.entity';
import { ExamAttempt } from '../students/entities/exam-attempt.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { UserType, SubscriptionStatus } from '../../types';
import { EmailService } from '../email/email.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AdminProfile)
    private adminProfileRepo: Repository<AdminProfile>,
    @InjectRepository(AdminRole)
    private adminRoleRepo: Repository<AdminRole>,
    @InjectRepository(AdminInvite)
    private adminInviteRepo: Repository<AdminInvite>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Question)
    private questionRepo: Repository<Question>,
    @InjectRepository(ExamAttempt)
    private examAttemptRepo: Repository<ExamAttempt>,
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    private jwtService: JwtService,
    @Inject(CACHE_MANAGER) private cache: Cache,
    private emailService: EmailService,
  ) {}

  // ─── Auth ──────────────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    const user = await this.userRepo.findOne({ where: { email } });

    if (!user || user.role !== UserType.ADMIN) {
      throw new BadRequestException('Invalid credentials');
    }

    if (!user.password) {
      throw new BadRequestException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new BadRequestException('Invalid credentials');

    const profile = await this.adminProfileRepo.findOne({
      where: { userId: user.id },
      relations: ['role'],
    });

    if (!profile || !profile.isActive) {
      throw new BadRequestException('Admin account is inactive');
    }

    const payload = {
      sub: user.id,
      role: user.role,
      isSuper: profile.isSuper,
      permissions: profile.modulePermissions,
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '8h' });

    // Cache perms on login
    await this.cache.set(
      `admin:perms:${user.id}`,
      {
        isSuper: profile.isSuper,
        modulePermissions: profile.modulePermissions,
      },
      5 * 60 * 1000,
    );

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      adminProfile: {
        isSuper: profile.isSuper,
        modulePermissions: profile.modulePermissions,
      },
    };
  }

  async acceptInvite(token: string, password: string) {
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const invite = await this.adminInviteRepo.findOne({
      where: { token: hashed, status: AdminInviteStatus.PENDING },
    });

    if (!invite || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite is invalid or has expired');
    }

    const existingUser = await this.userRepo.findOne({
      where: { email: invite.email },
    });
    if (existingUser) throw new ConflictException('Email already in use');

    const hashedPw = await bcrypt.hash(password, 12);
    const user = this.userRepo.create({
      email: invite.email,
      firstName: invite.firstName,
      lastName: invite.lastName,
      password: hashedPw,
      role: UserType.ADMIN,
      emailVerified: true,
    });
    await this.userRepo.save(user);

    const profile = this.adminProfileRepo.create({
      userId: user.id,
      isSuper: false,
      roleId: invite.roleId,
      modulePermissions: invite.modulePermissions,
      createdById: invite.createdById,
    });
    await this.adminProfileRepo.save(profile);

    invite.status = AdminInviteStatus.ACCEPTED;
    invite.acceptedAt = new Date();
    await this.adminInviteRepo.save(invite);

    return { message: 'Account created successfully. You can now log in.' };
  }

  // ─── Admin management ──────────────────────────────────────────────────────

  async listAdmins(page = 1, limit = 20) {
    const [items, total] = await this.adminProfileRepo.findAndCount({
      relations: ['user', 'role'],
      take: limit,
      skip: (page - 1) * limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items: items.map((p) => ({
        id: p.id,
        userId: p.userId,
        isSuper: p.isSuper,
        isActive: p.isActive,
        roleId: p.roleId,
        roleName: p.role?.name ?? null,
        modulePermissions: p.modulePermissions,
        user: p.user
          ? {
              email: p.user.email,
              firstName: p.user.firstName,
              lastName: p.user.lastName,
            }
          : null,
        createdAt: p.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async sendInvite(
    userId: string,
    email: string,
    firstName: string,
    lastName: string,
    roleId: string | null,
    modulePermissions: ModulePermissionsMap,
  ) {
    const profile = await this.adminProfileRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Admin profile not found');

    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

    const invite = this.adminInviteRepo.create({
      email,
      firstName,
      lastName,
      token: hashed,
      roleId: roleId ?? undefined,
      modulePermissions,
      createdById: profile.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await this.adminInviteRepo.save(invite);

    // Fire-and-forget: send invite email
    void this.emailService.sendAdminInviteEmail(email, firstName, rawToken);

    return { message: 'Invite sent' };
  }

  async updatePermissions(
    adminId: string,
    _updatedBy: string,
    modulePermissions: ModulePermissionsMap,
  ) {
    const profile = await this.adminProfileRepo.findOne({
      where: { id: adminId },
    });
    if (!profile) throw new NotFoundException('Admin not found');
    if (profile.isSuper)
      throw new BadRequestException('Cannot modify super admin permissions');

    profile.modulePermissions = modulePermissions;
    await this.adminProfileRepo.save(profile);

    // Invalidate cache
    await this.cache.del(`admin:perms:${profile.userId}`);

    return { message: 'Permissions updated' };
  }

  async deactivateAdmin(adminId: string) {
    const profile = await this.adminProfileRepo.findOne({
      where: { id: adminId },
    });
    if (!profile) throw new NotFoundException('Admin not found');
    if (profile.isSuper)
      throw new BadRequestException('Cannot deactivate super admin');

    profile.isActive = false;
    await this.adminProfileRepo.save(profile);
    await this.cache.del(`admin:perms:${profile.userId}`);
    return { message: 'Admin deactivated' };
  }

  async reactivateAdmin(adminId: string) {
    const profile = await this.adminProfileRepo.findOne({
      where: { id: adminId },
    });
    if (!profile) throw new NotFoundException('Admin not found');

    profile.isActive = true;
    await this.adminProfileRepo.save(profile);
    return { message: 'Admin reactivated' };
  }

  // ─── Role templates ────────────────────────────────────────────────────────

  async listRoles(page = 1, limit = 50, search?: string) {
    const qb = this.adminRoleRepo
      .createQueryBuilder('r')
      .orderBy('r.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    if (search) qb.where('r.name ILIKE :s', { s: `%${search}%` });
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page };
  }

  async createRole(
    name: string,
    description: string | null,
    modules: ModulePermissionsMap,
    createdById: string,
  ) {
    const existing = await this.adminRoleRepo.findOne({ where: { name } });
    if (existing) throw new ConflictException('Role name already taken');

    const role = this.adminRoleRepo.create({
      name,
      description,
      modules,
      createdById,
    });
    return this.adminRoleRepo.save(role);
  }

  async updateRole(
    roleId: string,
    name?: string,
    description?: string | null,
    modules?: ModulePermissionsMap,
  ) {
    const role = await this.adminRoleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    if (name !== undefined) role.name = name;
    if (description !== undefined) role.description = description;
    if (modules !== undefined) role.modules = modules;
    return this.adminRoleRepo.save(role);
  }

  async deleteRole(roleId: string) {
    const role = await this.adminRoleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    await this.adminRoleRepo.remove(role);
    return { message: 'Role deleted' };
  }

  // ─── Platform analytics (called by controller) ─────────────────────────────

  async getPlatformStats() {
    const QUESTION_TYPE_COLORS: Record<string, string> = {
      multiple_choice: '#007FFF',
      true_false: '#099137',
      multiple_response: '#A12161',
      essay: '#F3A218',
      fill_in_the_blank: '#D42620',
      short_answer: '#8B5CF6',
      matching: '#06B6D4',
    };
    const QUESTION_TYPE_LABELS: Record<string, string> = {
      multiple_choice: 'Multiple Choice',
      true_false: 'True / False',
      multiple_response: 'Multi-Response',
      essay: 'Essay',
      fill_in_the_blank: 'Fill in Blank',
      short_answer: 'Short Answer',
      matching: 'Matching',
    };
    const SUB_COLORS = ['#007FFF', '#A12161', '#099137', '#F3A218', '#D42620', '#8B5CF6', '#06B6D4'];

    const [
      totalStudents,
      totalSponsors,
      totalAffiliates,
      totalQuestionsInBank,
      avgResult,
      typeRows,
      subRows,
      totalActiveSubscriptions,
    ] = await Promise.all([
      this.userRepo.count({ where: { role: UserType.STUDENT } }),
      this.userRepo.count({ where: { role: UserType.SPONSOR } }),
      this.userRepo.count({ where: { role: UserType.AFFILIATE } }),
      this.questionRepo.count(),
      this.examAttemptRepo
        .createQueryBuilder('ea')
        .select('ROUND(AVG(ea."scorePercentage")::numeric, 1)', 'avg')
        .getRawOne<{ avg: string | null }>(),
      this.questionRepo
        .createQueryBuilder('q')
        .select(['q.type AS type', 'COUNT(*) AS count'])
        .groupBy('q.type')
        .getRawMany<{ type: string; count: string }>(),
      this.subscriptionRepo
        .createQueryBuilder('s')
        .leftJoin('s.examType', 'et')
        .select(['et.name AS name', 'COUNT(*) AS count'])
        .where('s.status = :status', { status: SubscriptionStatus.ACTIVE })
        .groupBy('et.name')
        .getRawMany<{ name: string; count: string }>(),
      this.subscriptionRepo.count({ where: { status: SubscriptionStatus.ACTIVE } }),
    ]);

    const totalUsers = totalStudents + totalSponsors + totalAffiliates;
    const avgPlatformScore = avgResult?.avg ? Number(avgResult.avg) : 0;

    const questionTypeBreakdown = typeRows.map((r) => ({
      name: QUESTION_TYPE_LABELS[r.type] ?? r.type,
      value: Number(r.count),
      fill: QUESTION_TYPE_COLORS[r.type] ?? '#757575',
    }));

    const subscriptionBreakdown = subRows.map((r, i) => ({
      name: r.name ?? 'Unknown',
      value: Number(r.count),
      fill: SUB_COLORS[i % SUB_COLORS.length],
    }));

    return {
      totalUsers,
      totalQuestionsInBank,
      avgPlatformScore,
      totalActiveSubscriptions,
      userBreakdown: [
        { name: 'Students', value: totalStudents, fill: '#007FFF' },
        { name: 'Sponsors', value: totalSponsors, fill: '#A12161' },
        { name: 'Affiliates', value: totalAffiliates, fill: '#099137' },
      ],
      questionTypeBreakdown,
      subscriptionBreakdown,
    };
  }

  async getRegistrationOverTime(
    granularity: 'day' | 'week' | 'month',
    timezone = 'UTC',
  ) {
    const now = new Date();
    let startDate: Date;
    let truncUnit: string;

    if (granularity === 'day') {
      const day = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - day);
      startDate.setHours(0, 0, 0, 0);
      truncUnit = 'day';
    } else if (granularity === 'week') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      truncUnit = 'week';
    } else {
      startDate = new Date(now.getFullYear(), 0, 1);
      truncUnit = 'month';
    }

    const rows = await this.userRepo
      .createQueryBuilder('u')
      .select([
        `DATE_TRUNC('${truncUnit}', u."createdAt" AT TIME ZONE '${timezone}') AS period`,
        `u.role AS role`,
        `COUNT(*) AS count`,
      ])
      .where('u."createdAt" >= :start', { start: startDate })
      .andWhere('u.role IN (:...roles)', {
        roles: [UserType.STUDENT, UserType.SPONSOR, UserType.AFFILIATE],
      })
      .groupBy('period, u.role')
      .orderBy('period', 'ASC')
      .getRawMany<{ period: string; role: string; count: string }>();

    // Build a period → { Students, Sponsors, Affiliates } map
    const map = new Map<
      string,
      { Students: number; Sponsors: number; Affiliates: number }
    >();
    for (const row of rows) {
      const key = new Date(row.period).toISOString().slice(0, 10);
      if (!map.has(key))
        map.set(key, { Students: 0, Sponsors: 0, Affiliates: 0 });
      const entry = map.get(key)!;
      const role = row.role as UserType;
      if (role === UserType.STUDENT) entry.Students += Number(row.count);
      else if (role === UserType.SPONSOR) entry.Sponsors += Number(row.count);
      else if (role === UserType.AFFILIATE)
        entry.Affiliates += Number(row.count);
    }

    return Array.from(map.entries()).map(([name, counts]) => ({
      name,
      ...counts,
    }));
  }
}
