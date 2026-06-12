import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { User } from '../../users/entities/user.entity';
import { UserType } from '../../../types';
import { AdminProfile } from '../entities/admin-profile.entity';
import {
  ADMIN_ACCESS_KEY,
  AdminAccessMeta,
} from '../decorators/admin-access.decorator';
import { ModulePermissionsMap } from '../entities/admin-role.entity';

const PERMS_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class AdminAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(AdminProfile)
    private adminProfileRepo: Repository<AdminProfile>,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user: User }>();
    const user = request.user;

    if (!user || user.role !== UserType.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    const meta = this.reflector.getAllAndOverride<AdminAccessMeta>(
      ADMIN_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!meta) return true;

    const perms = await this.getPermissions(user.id);

    if (!perms) throw new ForbiddenException('Admin profile not found');

    // isSuper bypasses all module checks
    if (perms.isSuper) return true;

    const modulePerms = perms.modulePermissions[meta.module];
    if (!modulePerms)
      throw new ForbiddenException('Access denied for this module');

    const allowed =
      meta.permission === 'read' ? modulePerms.canRead : modulePerms.canWrite;

    if (!allowed) throw new ForbiddenException('Access denied for this module');

    return true;
  }

  private async getPermissions(userId: string): Promise<{
    isSuper: boolean;
    modulePermissions: ModulePermissionsMap;
  } | null> {
    const cacheKey = `admin:perms:${userId}`;
    const cached = await this.cache.get<{
      isSuper: boolean;
      modulePermissions: ModulePermissionsMap;
    }>(cacheKey);

    if (cached) return cached;

    const profile = await this.adminProfileRepo.findOne({
      where: { userId },
    });

    if (!profile) return null;

    const payload = {
      isSuper: profile.isSuper,
      modulePermissions: profile.modulePermissions,
    };

    await this.cache.set(cacheKey, payload, PERMS_TTL_MS);
    return payload;
  }
}
