import { Controller, Get } from '@nestjs/common';

@Controller('api/health')
export class AppController {
  @Get()
  getHealth(): { status: string; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
