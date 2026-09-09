import { loadTemplate } from './load-template.util.js';

export function getSetPasswordEmailTemplate(params: {
  firstName: string;
  code: string;
}): { subject: string; html: string } {
  return {
    subject: 'Set Your iExcelo Password',
    html: loadTemplate('10-set-password.html', {
      name: params.firstName,
      code: params.code,
    }),
  };
}
