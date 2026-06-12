import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { IMigration } from '../migration-runner';
import { User } from '../../../users/entities/user.entity';
import { AdminProfile } from '../../../admin/entities/admin-profile.entity';
import { UserType } from '../../../../types';

export const migration005: IMigration = {
  name: '005-seed-superadmin',
  description:
    'Seeds the initial super admin account from environment variables',

  async run(dataSource: DataSource): Promise<void> {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const firstName = process.env.SUPER_ADMIN_FIRST_NAME ?? 'Super';
    const lastName = process.env.SUPER_ADMIN_LAST_NAME ?? 'Admin';

    if (!email || !password) {
      throw new Error(
        'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in environment variables',
      );
    }

    const userRepo = dataSource.getRepository(User);
    const profileRepo = dataSource.getRepository(AdminProfile);

    const existing = await userRepo.findOne({ where: { email } });
    if (existing) {
      console.log(`    Super admin ${email} already exists — skipping`);
      return;
    }

    const hashedPw = await bcrypt.hash(password, 12);
    const user = userRepo.create({
      email,
      firstName,
      lastName,
      password: hashedPw,
      role: UserType.ADMIN,
      emailVerified: true,
    });
    await userRepo.save(user);

    const profile = profileRepo.create({
      userId: user.id,
      isSuper: true,
      isActive: true,
      modulePermissions: {},
    });
    await profileRepo.save(profile);

    console.log(`    Super admin created: ${email}`);
  },
};
