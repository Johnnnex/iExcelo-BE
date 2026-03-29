import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  check() {
    return {
      success: true,
      message: 'Service is healthy',
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
      },
    };
  }
}
