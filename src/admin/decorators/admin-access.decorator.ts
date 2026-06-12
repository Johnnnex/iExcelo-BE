import { SetMetadata } from '@nestjs/common';
import { AdminModule } from '../entities/admin-role.entity';

export const ADMIN_ACCESS_KEY = 'adminAccess';

export interface AdminAccessMeta {
  module: AdminModule;
  permission: 'read' | 'write';
}

export const AdminAccess = (
  module: AdminModule,
  permission: 'read' | 'write',
) =>
  SetMetadata(ADMIN_ACCESS_KEY, {
    module,
    permission,
  } satisfies AdminAccessMeta);
