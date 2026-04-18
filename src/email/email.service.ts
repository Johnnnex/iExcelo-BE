/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { getWelcomeEmailTemplate } from './templates/welcome-email.template';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get('SMTP_PORT', 587),
      secure: false, // true for 465, false for other ports
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

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Password Reset Request - iExcelo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #007FFF;">Password Reset Request</h2>
          <p>Hi there,</p>
          <p>We received a request to reset your password for your iExcelo account.</p>
          <p>To reset your password, click the button below:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #007FFF; color: white; padding: 14px 28px; text-decoration: none; border-radius: 24px; display: inline-block; font-weight: 600;">
              Reset Your Password
            </a>
          </div>

          <p style="color: #667085; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #007FFF; font-size: 14px;">${resetUrl}</p>

          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #667085; font-size: 14px;">
              <strong>Security Notice:</strong><br/>
              This password reset link expires in 1 hour for your security.
            </p>
          </div>

          <div style="margin-top: 30px; color: #667085; font-size: 12px;">
            <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; text-align: center; color: #667085; font-size: 12px;">
            <p>© ${new Date().getFullYear()} iExcelo. All rights reserved.</p>
          </div>
        </div>
      `,
    });
  }

  async sendVerificationEmail(email: string, verificationCode: string) {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Verify Your Email - iExcelo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #007FFF;">Email Verification</h2>
          <p>Hi there,</p>
          <p>Welcome to iExcelo! Please use the verification code below to verify your email address:</p>

          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 12px; display: inline-block;">
              <h1 style="font-size: 32px; letter-spacing: 8px; margin: 0; color: #007FFF; font-weight: 700;">${verificationCode}</h1>
            </div>
          </div>

          <p style="text-align: center; color: #667085; font-size: 14px;">Enter this code on the verification page to continue</p>

          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #667085; font-size: 14px;">
              <strong>Security Notice:</strong><br/>
              This verification code expires in 24 hours.
            </p>
          </div>

          <div style="margin-top: 30px; color: #667085; font-size: 12px;">
            <p>If you didn't create an account with iExcelo, please ignore this email.</p>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; text-align: center; color: #667085; font-size: 12px;">
            <p>© ${new Date().getFullYear()} iExcelo. All rights reserved.</p>
          </div>
        </div>
      `,
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

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Welcome to iExcelo - Complete Your Setup',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #007FFF;">Welcome to iExcelo, ${firstName}!</h2>
          <p>Hi ${firstName} ${lastName},</p>
          <p>Thank you for signing up with iExcelo! We're excited to have you on board.</p>
          <p>To get started and access your personalized dashboard, please complete your account setup by clicking the button below:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${onboardingUrl}" style="background-color: #007FFF; color: white; padding: 14px 28px; text-decoration: none; border-radius: 24px; display: inline-block; font-weight: 600;">
              Complete Your Setup
            </a>
          </div>

          <p style="color: #667085; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #007FFF; font-size: 14px;">${onboardingUrl}</p>

          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #667085; font-size: 14px;">
              <strong>What happens next?</strong><br/>
              1. Click the setup button above<br/>
              2. Choose your account preferences<br/>
              3. Start your learning journey with iExcelo!
            </p>
          </div>

          <div style="margin-top: 30px; color: #667085; font-size: 12px;">
            <p>This setup link will remain valid until you complete your onboarding. If you've already completed your setup, you can safely ignore this email.</p>
            <p>If you didn't create an account with iExcelo, please ignore this email.</p>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; text-align: center; color: #667085; font-size: 12px;">
            <p>© ${new Date().getFullYear()} iExcelo. All rights reserved.</p>
          </div>
        </div>
      `,
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

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: "You've Been Sponsored on iExcelo — Activate Your Account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #007FFF;">Welcome to iExcelo, ${firstName}!</h2>
          <p>Hi ${firstName},</p>
          <p><strong>${sponsorName}</strong> has created an iExcelo account for you and is sponsoring your exam preparation journey.</p>
          <p>To get started, click the button below to activate your account and set your password:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${activationUrl}" style="background-color: #007FFF; color: white; padding: 14px 28px; text-decoration: none; border-radius: 24px; display: inline-block; font-weight: 600;">
              Activate My Account
            </a>
          </div>

          <p style="color: #667085; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #007FFF; font-size: 14px;">${activationUrl}</p>

          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #667085; font-size: 14px;">
              <strong>What happens next?</strong><br/>
              1. Click the activation button above<br/>
              2. Set your password<br/>
              3. Log in and start preparing for your exams!
            </p>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #667085; font-size: 14px;">
              <strong>Security Notice:</strong> This activation link expires in 7 days.
            </p>
          </div>

          <div style="margin-top: 30px; color: #667085; font-size: 12px;">
            <p>If you weren't expecting this email, you can safely ignore it.</p>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; text-align: center; color: #667085; font-size: 12px;">
            <p>© ${new Date().getFullYear()} iExcelo. All rights reserved.</p>
          </div>
        </div>
      `,
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

    const messageRows = messages
      .map(
        (m) => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #F3F4F6;">
            <p style="margin: 0 0 4px 0; font-weight: 600; color: #111827;">${m.senderName}</p>
            <p style="margin: 0 0 8px 0; color: #374151; font-size: 14px;">"${m.preview}"</p>
            <a href="${frontendUrl}/messages/${m.chatroomId}"
               style="color: #007FFF; font-size: 13px; text-decoration: none;">
              Reply →
            </a>
          </td>
        </tr>`,
      )
      .join('');

    const subject =
      messages.length === 1
        ? `New message from ${messages[0].senderName} — iExcelo`
        : `${messages.length} new messages waiting for you — iExcelo`;

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #007FFF;">
            ${messages.length === 1 ? 'You have a new message' : `You have ${messages.length} new messages`}
          </h2>
          <p>Hi ${firstName},</p>
          <p>
            ${
              messages.length === 1
                ? `${messages[0].senderName} sent you a message on iExcelo.`
                : `You received ${messages.length} messages while you were away.`
            }
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
            ${messageRows}
          </table>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${frontendUrl}/messages"
               style="background-color: #007FFF; color: white; padding: 14px 28px;
                      text-decoration: none; border-radius: 24px; display: inline-block; font-weight: 600;">
              Open Messages
            </a>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;
                      text-align: center; color: #667085; font-size: 12px;">
            <p>You're receiving this because you have messages waiting on iExcelo.</p>
            <p>© ${new Date().getFullYear()} iExcelo. All rights reserved.</p>
          </div>
        </div>
      `,
    });
  }

  async sendWelcomeEmail(
    email: string,
    firstName: string,
    lastName: string,
    userType?: string,
  ) {
    const template = getWelcomeEmailTemplate({
      firstName,
      lastName,
      userType,
    });

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: template.subject,
      html: template.html,
    });
  }
}
