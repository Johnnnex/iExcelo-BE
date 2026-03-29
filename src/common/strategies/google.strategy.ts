/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>(
        'GOOGLE_CALLBACK_URL',
        'http://localhost:3000/api/v1/auth/google/callback',
      ),
      scope: ['email', 'profile'],
      passReqToCallback: true, // Enable request object in validate method
    });
  }

  async validate(
    _req: any,
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id: string;
      name: { givenName: string; familyName: string };
      emails: [{ value: string }];
    },
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails } = profile;

    const user = {
      googleId: id,
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
    };

    // Unified flow: always create user if not exists, redirect to onboarding if needed
    const result = await this.authService.findOrCreateGoogleUser(user);

    const userWithMetadata = {
      ...result.user,
      _isNewUser: result.isNewUser,
      _needsOnboarding: result.needsOnboarding,
    };

    done(null, userWithMetadata);
  }
}
