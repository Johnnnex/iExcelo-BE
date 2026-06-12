import { DataSource } from 'typeorm';
import { IMigration } from '../migration-runner';
import { AdminRole } from '../../../admin/entities/admin-role.entity';
import {
  AdminModule,
  ModulePermissionsMap,
} from '../../../admin/entities/admin-role.entity';

const full: ModulePermissionsMap = Object.fromEntries(
  Object.values(AdminModule).map((m) => [m, { canRead: true, canWrite: true }]),
) as ModulePermissionsMap;

const readOnly: ModulePermissionsMap = Object.fromEntries(
  Object.values(AdminModule).map((m) => [
    m,
    { canRead: true, canWrite: false },
  ]),
) as ModulePermissionsMap;

const contentEditor: ModulePermissionsMap = {
  [AdminModule.EXAM_REVISION]: { canRead: true, canWrite: true },
  [AdminModule.TESTIMONIALS]: { canRead: true, canWrite: true },
  [AdminModule.BULK_EMAILS]: { canRead: true, canWrite: true },
  [AdminModule.ANALYTICS]: { canRead: true, canWrite: false },
};

const supportAgent: ModulePermissionsMap = {
  [AdminModule.STUDENTS]: { canRead: true, canWrite: true },
  [AdminModule.SPONSORS]: { canRead: true, canWrite: true },
  [AdminModule.AFFILIATES]: { canRead: true, canWrite: true },
  [AdminModule.MESSAGES]: { canRead: true, canWrite: true },
  [AdminModule.SUBSCRIPTIONS]: { canRead: true, canWrite: false },
  [AdminModule.ANALYTICS]: { canRead: true, canWrite: false },
};

const defaultRoles: Array<{
  name: string;
  description: string;
  modules: ModulePermissionsMap;
}> = [
  {
    name: 'Full Access',
    description: 'Read and write access to all modules',
    modules: full,
  },
  {
    name: 'Read Only',
    description: 'Read-only access to all modules',
    modules: readOnly,
  },
  {
    name: 'Content Editor',
    description: 'Manages exam content, testimonials, and bulk email campaigns',
    modules: contentEditor,
  },
  {
    name: 'Support Agent',
    description: 'Handles user management, messages, and subscriptions',
    modules: supportAgent,
  },
];

export const migration006: IMigration = {
  name: '006-seed-role-templates',
  description: 'Seeds default admin role templates',

  async run(dataSource: DataSource): Promise<void> {
    const roleRepo = dataSource.getRepository(AdminRole);

    let inserted = 0;
    let skipped = 0;

    for (const data of defaultRoles) {
      const existing = await roleRepo.findOne({ where: { name: data.name } });
      if (existing) {
        skipped++;
        continue;
      }
      await roleRepo.save(roleRepo.create(data));
      inserted++;
    }

    console.log(
      `    Role templates: ${inserted} inserted, ${skipped} already existed`,
    );
  },
};
