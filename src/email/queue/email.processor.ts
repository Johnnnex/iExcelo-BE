import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from '../email.service';
import {
  EMAILS_QUEUE,
  EmailJobs,
  SendVerificationEmailJobData,
  SendPasswordResetEmailJobData,
  SendOnboardingEmailJobData,
  SendWelcomeEmailJobData,
  SendSponsoredActivationEmailJobData,
} from './email.queue';

@Processor(EMAILS_QUEUE)
export class EmailsProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailsProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case EmailJobs.SEND_VERIFICATION:
        await this.handleSendVerification(
          job as Job<SendVerificationEmailJobData>,
        );
        break;
      case EmailJobs.SEND_PASSWORD_RESET:
        await this.handleSendPasswordReset(
          job as Job<SendPasswordResetEmailJobData>,
        );
        break;
      case EmailJobs.SEND_ONBOARDING:
        await this.handleSendOnboarding(job as Job<SendOnboardingEmailJobData>);
        break;
      case EmailJobs.SEND_WELCOME:
        await this.handleSendWelcome(job as Job<SendWelcomeEmailJobData>);
        break;
      case EmailJobs.SEND_SPONSORED_ACTIVATION:
        await this.handleSendSponsoredActivation(
          job as Job<SendSponsoredActivationEmailJobData>,
        );
        break;
      default:
        this.logger.warn(`Unknown email job: ${job.name}`);
    }
  }

  private async handleSendVerification(
    job: Job<SendVerificationEmailJobData>,
  ): Promise<void> {
    const { email, verificationCode } = job.data;
    this.logger.log(`Sending verification email to ${email}`);
    try {
      await this.emailService.sendVerificationEmail(email, verificationCode);
    } catch (err: unknown) {
      this.logger.error(
        `Verification email failed for ${email}: ${(err as Error)?.message}`,
      );
      throw err;
    }
  }

  private async handleSendPasswordReset(
    job: Job<SendPasswordResetEmailJobData>,
  ): Promise<void> {
    const { email, resetToken } = job.data;
    this.logger.log(`Sending password reset email to ${email}`);
    try {
      await this.emailService.sendPasswordResetEmail(email, resetToken);
    } catch (err: unknown) {
      this.logger.error(
        `Password reset email failed for ${email}: ${(err as Error)?.message}`,
      );
      throw err;
    }
  }

  private async handleSendOnboarding(
    job: Job<SendOnboardingEmailJobData>,
  ): Promise<void> {
    const { email, firstName, lastName, onboardingToken } = job.data;
    this.logger.log(`Sending onboarding email to ${email}`);
    try {
      await this.emailService.sendOnboardingEmail(
        email,
        firstName,
        lastName,
        onboardingToken,
      );
    } catch (err: unknown) {
      this.logger.error(
        `Onboarding email failed for ${email}: ${(err as Error)?.message}`,
      );
      throw err;
    }
  }

  private async handleSendWelcome(
    job: Job<SendWelcomeEmailJobData>,
  ): Promise<void> {
    const { email, firstName, lastName, userType } = job.data;
    this.logger.log(`Sending welcome email to ${email}`);
    try {
      await this.emailService.sendWelcomeEmail(
        email,
        firstName,
        lastName,
        userType,
      );
    } catch (err: unknown) {
      this.logger.error(
        `Welcome email failed for ${email}: ${(err as Error)?.message}`,
      );
      throw err;
    }
  }

  private async handleSendSponsoredActivation(
    job: Job<SendSponsoredActivationEmailJobData>,
  ): Promise<void> {
    const { email, firstName, rawToken, sponsorName } = job.data;
    this.logger.log(`Sending sponsored activation email to ${email}`);
    try {
      await this.emailService.sendSponsoredActivationEmail(
        email,
        firstName,
        rawToken,
        sponsorName,
      );
    } catch (err: unknown) {
      this.logger.error(
        `Sponsored activation email failed for ${email}: ${(err as Error)?.message}`,
      );
      throw err;
    }
  }
}
