export const EMAILS_QUEUE = 'emails';

export const EmailJobs = {
  SEND_VERIFICATION: 'send_verification_email',
  SEND_PASSWORD_RESET: 'send_password_reset_email',
  SEND_ONBOARDING: 'send_onboarding_email',
  SEND_WELCOME: 'send_welcome_email',
  SEND_SPONSORED_ACTIVATION: 'send_sponsored_activation_email',
} as const;

export interface SendVerificationEmailJobData {
  email: string;
  verificationCode: string;
}

export interface SendPasswordResetEmailJobData {
  email: string;
  resetToken: string;
}

export interface SendOnboardingEmailJobData {
  email: string;
  firstName: string;
  lastName: string;
  onboardingToken: string;
}

export interface SendWelcomeEmailJobData {
  email: string;
  firstName: string;
  lastName: string;
  userType?: string;
}

export interface SendSponsoredActivationEmailJobData {
  email: string;
  firstName: string;
  rawToken: string;
  sponsorName: string;
}
