import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import {
  GoogleStrategy,
  JwtStrategy,
  LocalStrategy,
} from '../common/strategies';
import { UsersModule } from '../users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordResetToken } from './entities/password-reset-tokens.entity';
import { RefreshToken } from './entities/refresh-tokens.entity';
import { EmailVerificationCode } from './entities/email-verification-codes.entity';
import { OnboardingToken } from './entities/onboarding-token.entity';
import { EmailModule } from '../email/email.module';
import { StudentsModule } from '../students/students.module';
import { SponsorsModule } from '../sponsors/sponsors.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RefreshToken,
      PasswordResetToken,
      EmailVerificationCode,
      OnboardingToken,
    ]),

    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        global: true,
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRATION') ||
            '1h') as unknown as number, // Gosh, typescript!
        },
      }),
      inject: [ConfigService],
    }),

    EmailModule,
    PassportModule,
    UsersModule,
    StudentsModule,
    SponsorsModule,
    AffiliatesModule,
    LoggerModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy, GoogleStrategy],
})
export class AuthModule {}
