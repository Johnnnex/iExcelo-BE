/**
 * Run with: npx ts-node -P tsconfig.json src/email/templates/generate-previews.ts
 * Writes HTML preview files to /Backend/html/
 */

import * as fs from 'fs';
import * as path from 'path';

import { getPasswordResetEmailTemplate } from './password-reset.template';
import { getVerificationEmailTemplate } from './verification.template';
import { getOnboardingEmailTemplate } from './onboarding.template';
import { getSponsoredActivationEmailTemplate } from './sponsored-activation.template';
import { getNewMessagesEmailTemplate } from './new-messages.template';
import { getAdminInviteEmailTemplate } from './admin-invite.template';
import { getWelcomeEmailTemplate } from './welcome-email.template';
import { getBulkCampaignEmailTemplate } from './bulk-campaign.template';
import { getStripeReceiptEmailTemplate } from './stripe-receipt.template';
import { CampaignCategory } from '../../admin/entities/bulk-email-campaign.entity';

const OUT_DIR = path.join(__dirname, '..', '..', '..', 'html');
fs.mkdirSync(OUT_DIR, { recursive: true });

function write(filename: string, html: string) {
  const dest = path.join(OUT_DIR, filename);
  fs.writeFileSync(dest, html, 'utf-8');
  console.log(`  ✓  ${filename}`);
}

// 1. Password reset
(() => {
  const { html } = getPasswordResetEmailTemplate({
    resetUrl: 'https://iexcelo.com/reset/confirm?token=SAMPLE_TOKEN',
  });
  write('01-password-reset.html', html);
})();

// 2. Verification
(() => {
  const { html } = getVerificationEmailTemplate({ verificationCode: '483920' });
  write('02-email-verification.html', html);
})();

// 3. Onboarding (Google OAuth)
(() => {
  const { html } = getOnboardingEmailTemplate({
    firstName: 'Femi',
    lastName: 'Adeyemi',
    onboardingUrl: 'https://iexcelo.com/auth/onboarding?token=SAMPLE_TOKEN',
  });
  write('03-onboarding.html', html);
})();

// 4. Sponsored activation
(() => {
  const { html } = getSponsoredActivationEmailTemplate({
    firstName: 'Tunde',
    sponsorName: 'Zenith Bank Foundation',
    activationUrl: 'https://iexcelo.com/auth/activate?token=SAMPLE_TOKEN',
  });
  write('04-sponsored-activation.html', html);
})();

// 5a. New messages (single)
(() => {
  const { html } = getNewMessagesEmailTemplate({
    firstName: 'Amara',
    frontendUrl: 'https://iexcelo.com',
    messages: [
      {
        senderName: 'Dr. Chukwuemeka',
        preview:
          'Hi Amara, I reviewed your practice test results and have some tips for you...',
        chatroomId: 'room_abc123',
      },
    ],
  });
  write('05a-new-message-single.html', html);
})();

// 5b. New messages (multiple)
(() => {
  const { html } = getNewMessagesEmailTemplate({
    firstName: 'Amara',
    frontendUrl: 'https://iexcelo.com',
    messages: [
      {
        senderName: 'Dr. Chukwuemeka',
        preview: 'Hi Amara, I reviewed your practice test results...',
        chatroomId: 'room_abc123',
      },
      {
        senderName: 'Ngozi Okafor',
        preview: 'Are you joining the study group session on Thursday evening?',
        chatroomId: 'room_def456',
      },
      {
        senderName: 'iExcelo Support',
        preview: 'Your subscription has been renewed successfully.',
        chatroomId: 'room_ghi789',
      },
    ],
  });
  write('05b-new-messages-batch.html', html);
})();

// 6. Admin invite
(() => {
  const { html } = getAdminInviteEmailTemplate({
    firstName: 'Kemi',
    inviteUrl: 'http://admin.iexcelo.com/accept-invite?token=SAMPLE_TOKEN',
  });
  write('06-admin-invite.html', html);
})();

// 7a. Welcome – student
(() => {
  const { html } = getWelcomeEmailTemplate({
    firstName: 'David',
    lastName: 'Nwosu',
    userType: 'student',
  });
  write('07a-welcome-student.html', html);
})();

// 7b. Welcome – sponsor
(() => {
  const { html } = getWelcomeEmailTemplate({
    firstName: 'Patricia',
    lastName: 'Eze',
    userType: 'sponsor',
  });
  write('07b-welcome-sponsor.html', html);
})();

// 7c. Welcome – affiliate
(() => {
  const { html } = getWelcomeEmailTemplate({
    firstName: 'Samuel',
    lastName: 'Bello',
    userType: 'affiliate',
  });
  write('07c-welcome-affiliate.html', html);
})();

// 8a. Bulk campaign – newsletter
(() => {
  const { html } = getBulkCampaignEmailTemplate({
    firstName: 'Chioma',
    category: CampaignCategory.NEWSLETTER,
    htmlContent: /* html */ `
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1a1a1a;">Weekly Digest — Top Resources &amp; Platform News</h2>
      <p style="margin:0 0 16px;line-height:1.8;">
        Here's what's new on iExcelo this week: we've added 200+ new WAEC Chemistry questions,
        improved our analytics dashboard, and our new mock exam timer is live.
      </p>
      <p style="margin:0;line-height:1.8;">
        Head to your dashboard to explore all the new content waiting for you.
      </p>
    `,
  });
  write('08a-bulk-newsletter.html', html);
})();

// 8b. Bulk campaign – security alert
(() => {
  const { html } = getBulkCampaignEmailTemplate({
    firstName: 'Chioma',
    category: CampaignCategory.SECURITY_ALERTS,
    htmlContent: /* html */ `
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1a1a1a;">Important Platform Security Notice</h2>
      <p style="margin:0 0 16px;line-height:1.8;">
        We want to inform all iExcelo users of an important security advisory.
        We are rolling out enhanced two-factor authentication controls — we recommend enabling
        2FA in your security settings.
      </p>
      <p style="margin:0;line-height:1.8;">
        If you notice any suspicious activity on your account, please contact us immediately at
        <a href="mailto:security@iexcelo.com" style="color:#D42620;">security@iexcelo.com</a>.
      </p>
    `,
  });
  write('08b-bulk-security-alert.html', html);
})();

// 9. Stripe payment receipt
(() => {
  const { html } = getStripeReceiptEmailTemplate({
    firstName: 'Ekundayo',
    amount: 500,
    currency: 'eur',
    cardBrand: 'mastercard',
    cardLast4: '5454',
    receiptUrl: 'https://pay.stripe.com/receipts/acct_example/ch_example/rcpt_example',
  });
  write('09-stripe-receipt.html', html);
})();

console.log('\nAll preview files written to /Backend/html/');
