import { loadTemplate } from './load-template.util.js';

export function getVerificationEmailTemplate(params: {
  verificationCode: string;
}): { subject: string; html: string } {
  return {
    subject: 'Verify Your Email',
    html: loadTemplate('02-email-verification.html', {
      code: params.verificationCode,
    }),
  };
}
