/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { CampaignCategory } from '../admin/entities/bulk-email-campaign.entity';
import { getPasswordResetEmailTemplate } from './templates/password-reset.template';
import { getVerificationEmailTemplate } from './templates/verification.template';
import { getOnboardingEmailTemplate } from './templates/onboarding.template';
import { getSponsoredActivationEmailTemplate } from './templates/sponsored-activation.template';
import { getNewMessagesEmailTemplate } from './templates/new-messages.template';
import { getAdminInviteEmailTemplate } from './templates/admin-invite.template';
import { getWelcomeEmailTemplate } from './templates/welcome-email.template';
import { getBulkCampaignEmailTemplate } from './templates/bulk-campaign.template';
import { getSetPasswordEmailTemplate } from './templates/set-password.template';
import { getStripeReceiptEmailTemplate } from './templates/stripe-receipt.template';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });

    const address = this.configService.get('SMTP_FROM', 'noreply@iexcelo.com');
    const name = this.configService.get('SMTP_FROM_NAME', 'iExcelo');
    this.from = `${name} <${address}>`;
  }

  async sendPasswordResetEmail(email: string, resetToken: string) {
    const frontendUrl = this.configService.get('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/reset/confirm?token=${resetToken}`;
    const { subject, html } = getPasswordResetEmailTemplate({ resetUrl });
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject,
      html,
    });
  }

  async sendVerificationEmail(email: string, verificationCode: string) {
    const { subject, html } = getVerificationEmailTemplate({
      verificationCode,
    });
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject,
      html,
    });
  }

  async sendOnboardingEmail(
    email: string,
    firstName: string,
    lastName: string,
    onboardingToken: string,
  ) {
    const frontendUrl = this.configService.get('FRONTEND_URL');
    const onboardingUrl = `${frontendUrl}/auth/onboarding?token=${onboardingToken}`;
    const { subject, html } = getOnboardingEmailTemplate({
      firstName,
      lastName,
      onboardingUrl,
    });
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject,
      html,
    });
  }

  async sendSponsoredActivationEmail(
    email: string,
    firstName: string,
    rawToken: string,
    sponsorName: string,
  ) {
    const frontendUrl = this.configService.get('FRONTEND_URL');
    const activationUrl = `${frontendUrl}/auth/activate?token=${rawToken}`;
    const { subject, html } = getSponsoredActivationEmailTemplate({
      firstName,
      sponsorName,
      activationUrl,
    });
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject,
      html,
    });
  }

  async sendNewMessagesBatchEmail(
    email: string,
    firstName: string,
    messages: Array<{
      senderName: string;
      preview: string;
      chatroomId: string;
    }>,
  ) {
    const frontendUrl = this.configService.get(
      'FRONTEND_URL',
      'https://iexcelo.com',
    );
    const { subject, html } = getNewMessagesEmailTemplate({
      firstName,
      messages,
      frontendUrl,
    });
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject,
      html,
    });
  }

  async sendAdminInviteEmail(
    email: string,
    firstName: string,
    rawToken: string,
  ) {
    const adminUrl = this.configService.get(
      'ADMIN_URL',
      'http://localhost:5555',
    );
    const inviteUrl = `${adminUrl}/accept-invite?token=${rawToken}`;
    const { subject, html } = getAdminInviteEmailTemplate({
      firstName,
      inviteUrl,
    });
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject,
      html,
    });
  }

  async sendWelcomeEmail(
    email: string,
    firstName: string,
    lastName: string,
    userType?: string,
  ) {
    const { subject, html } = getWelcomeEmailTemplate({
      firstName,
      lastName,
      userType,
    });
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject,
      html,
    });
  }

  async sendSetPasswordEmail(email: string, firstName: string, code: string) {
    const { subject, html } = getSetPasswordEmailTemplate({ firstName, code });
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject,
      html,
    });
  }

  async sendStripeReceiptEmail(params: {
    email: string;
    firstName: string;
    amount: number;
    currency: string;
    cardBrand: string;
    cardLast4: string;
    receiptUrl: string;
  }) {
    const { email, ...rest } = params;
    const { subject, html } = getStripeReceiptEmailTemplate(rest);
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject,
      html,
    });
  }

  async sendBulkCampaignEmail(
    to: string,
    firstName: string,
    subject: string,
    htmlContent: string,
    category: CampaignCategory = CampaignCategory.NEWSLETTER,
  ) {
    const { html } = getBulkCampaignEmailTemplate({
      firstName,
      htmlContent,
      category,
    });
    await this.transporter.sendMail({ from: this.from, to, subject, html });
  }
}
