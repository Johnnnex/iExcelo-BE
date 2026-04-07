/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ApiKeyGuard } from './common/guards';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  // ========== Global Prefix ==========
  app.setGlobalPrefix('api/v1');

  // ========== CORS ==========
  app.enableCors({
    origin: configService.get('FRONTEND_URL'),
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

  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`📚 API Base URL: http://localhost:${port}/api/v1`);
}

bootstrap();
