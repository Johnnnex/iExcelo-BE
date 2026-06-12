import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageFlag, FlagStatus } from '../chats/entities/message-flag.entity';
import { AdminProfile } from './entities/admin-profile.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AdminMessagesService {
  constructor(
    @InjectRepository(MessageFlag)
    private flagRepo: Repository<MessageFlag>,
    @InjectRepository(AdminProfile)
    private adminProfileRepo: Repository<AdminProfile>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async listFlags(page = 1, limit = 20, status?: FlagStatus) {
    const qb = this.flagRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.message', 'msg')
      .leftJoinAndSelect('msg.sender', 'sender')
      .leftJoinAndSelect('f.chatroom', 'chatroom')
      .leftJoinAndSelect('f.reportedBy', 'reporter')
      .orderBy('f.createdAt', 'DESC');

    if (status) {
      qb.where('f.status = :status', { status });
    }

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items, total, page, limit };
  }

  async reviewFlag(id: string, adminUserId: string, adminNotes?: string) {
    const [flag, profile] = await Promise.all([
      this.flagRepo.findOne({ where: { id } }),
      this.adminProfileRepo.findOne({ where: { userId: adminUserId } }),
    ]);
    if (!flag) throw new NotFoundException('Flag not found');

    flag.status = FlagStatus.REVIEWED;
    flag.reviewedByAdminId = profile?.id ?? adminUserId;
    flag.reviewedAt = new Date();
    if (adminNotes !== undefined) flag.adminNotes = adminNotes;
    return this.flagRepo.save(flag);
  }

  async dismissFlag(id: string, adminUserId: string, adminNotes?: string) {
    const [flag, profile] = await Promise.all([
      this.flagRepo.findOne({ where: { id } }),
      this.adminProfileRepo.findOne({ where: { userId: adminUserId } }),
    ]);
    if (!flag) throw new NotFoundException('Flag not found');

    flag.status = FlagStatus.DISMISSED;
    flag.reviewedByAdminId = profile?.id ?? adminUserId;
    flag.reviewedAt = new Date();
    if (adminNotes !== undefined) flag.adminNotes = adminNotes;
    return this.flagRepo.save(flag);
  }

  async suspendUser(userId: string, suspendedUntil: Date) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.suspendedUntil = suspendedUntil;
    await this.userRepo.save(user);
    return { message: 'User suspended' };
  }
}
