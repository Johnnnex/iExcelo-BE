import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailService } from './email.service';
import { EmailsProcessor } from './queue/email.processor';
import { EMAILS_QUEUE } from './queue/email.queue';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: EMAILS_QUEUE })],
  providers: [EmailService, EmailsProcessor],
  exports: [EmailService],
})
export class EmailModule {}
