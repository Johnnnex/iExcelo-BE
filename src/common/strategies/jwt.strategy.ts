/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../auth/auth.service';
import { TokenPayload } from '../../../types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: TokenPayload) {
    // Validate that the refresh token associated with this access token is still valid
    const user = await this.authService.validateAccessTokenPayload(payload);

    if (!user) {
      throw new UnauthorizedException('Invalid token or session expired');
    }

    // Attach userId alias and refreshTokenId from the JWT payload so controllers
    // can read req.user.userId and req.user.refreshTokenId reliably.
    // The User entity only has `id`; without this alias every updateProfile call
    // was passing `undefined` as the userId (TypeORM then dropped the WHERE clause
    // and matched the first row in the table — corrupting records).
    return {
      ...user,
      userId: user.id,
      refreshTokenId: payload.refreshTokenId ?? null,
    };
  }
}
