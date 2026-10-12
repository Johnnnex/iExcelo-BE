/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable, UnauthorizedException } from '@nestjs/common';
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
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id: string;
      name: { givenName: string; familyName?: string };
      emails: [{ value: string }];
    },
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails } = profile;

    // The state param carries a signed JWT for the connect flow.
    // Verify the token before trusting the userId it contains.
    const rawState = req?.query?.state as string | undefined;
    let connectUserId: string | undefined;

    if (rawState && rawState !== 'login') {
      try {
        connectUserId = this.authService.verifyConnectStateToken(rawState);
      } catch {
        return done(
          new UnauthorizedException('Invalid or expired Google connect state'),
          false,
        );
      }
    }

    if (connectUserId) {
      // Connect flow: link this Google account to the already-authenticated user.
      const result = await this.authService.connectGoogleToUser(
        connectUserId,
        id,
        emails[0].value,
      );
      return done(null, {
        _connectResult: result,
        _connectUserId: connectUserId,
      });
    }

    // Login / signup flow
    const googleUser = {
      googleId: id,
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName ?? null,
    };

    const result = await this.authService.findOrCreateGoogleUser(googleUser);

    done(null, {
      ...result.user,
      _isNewUser: result.isNewUser,
      _needsOnboarding: result.needsOnboarding,
    });
  }
}
