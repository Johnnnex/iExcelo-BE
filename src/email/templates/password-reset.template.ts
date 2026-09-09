import { loadTemplate } from './load-template.util.js';

export function getPasswordResetEmailTemplate(params: { resetUrl: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: 'Reset Your Password',
    html: loadTemplate('01-password-reset.html', { resetUrl: params.resetUrl }),
  };
}
