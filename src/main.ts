/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ApiKeyGuard } from './common/guards';
import { ConfigService } from '@nestjs/config';
import { RedisIoAdapter } from './redis-io.adapter';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Required for Stripe webhook signature verification
    logger: isProduction ? false : ['log', 'debug', 'error', 'warn', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);
  const logger = new Logger('Bootstrap');

  // ========== WebSocket Adapter (Redis) ==========
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(configService);
  app.useWebSocketAdapter(redisIoAdapter);

  // ========== Global Prefix ==========
  app.setGlobalPrefix('api/v1');

  // ========== CORS ==========
  const allowedOrigins = [
    configService.get<string>('FRONTEND_URL') ?? '',
    configService.get<string>('ADMIN_URL') ?? '',
  ]
    .filter(Boolean)
    .map((u) => u.replace(/\/$/, '')); // strip trailing slashes

  if (allowedOrigins.length === 0) {
    logger.warn(
      'No FRONTEND_URL or ADMIN_URL set -- CORS will block all browser requests',
    );
  } else {
    logger.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
  }

  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) {
      // Allow server-to-server / Postman requests (no origin header)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin "${origin}" not allowed`));
    },
    credentials: true,
  });

  // ========== Global Validation Pipe ==========
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if extra properties
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Convert primitive types
      },
    }),
  );

  // ========== Global Exception Filter ==========
  app.useGlobalFilters(new HttpExceptionFilter());

  // ========== Global Response Transform ==========
  app.useGlobalInterceptors(new TransformInterceptor());

  // ========== Global Guards ==========
  // Apply API Key guard globally
  app.useGlobalGuards(new ApiKeyGuard(configService, reflector));

  // ========== Start Server ==========
  const port = configService.get('PORT', 3000);
  await app.listen(port as string);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`API Base URL: http://localhost:${port}/api/v1`);
}

bootstrap();
