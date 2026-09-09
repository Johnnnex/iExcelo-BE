import { loadTemplate } from './load-template.util.js';

export function getAdminInviteEmailTemplate(params: {
  firstName: string;
  inviteUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `You're Invited to the iExcelo Admin Panel`,
    html: loadTemplate('06-admin-invite.html', {
      name: params.firstName,
      inviteUrl: params.inviteUrl,
    }),
  };
}
