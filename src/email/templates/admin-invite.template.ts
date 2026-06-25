import {
  baseTemplate,
  ctaButton,
  fallbackLink,
  greeting,
  signoff,
} from './base.template';

export function getAdminInviteEmailTemplate(params: {
  firstName: string;
  inviteUrl: string;
}): { subject: string; html: string } {
  const { firstName, inviteUrl } = params;

  const body = /* html */ `
    ${greeting(firstName)}

    <p class="body-sub" style="margin:0 0 8px;font-size:15px;color:#444444;line-height:1.75;">
      You've been invited to join the <strong>iExcelo Admin Panel</strong> — the central control
      hub for managing students, content, campaigns, and platform operations.
    </p>

    <p class="body-sub" style="margin:0 0 28px;font-size:15px;color:#444444;line-height:1.75;">
      Click the button below to set up your administrator account.
    </p>

    ${ctaButton('Accept Invitation', inviteUrl, '#A12161')}

    ${fallbackLink(inviteUrl)}

    <!-- Capabilities -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#FDF4F9;border-left:4px solid #A12161;border-radius:0 8px 8px 0;margin:0 0 28px;">
      <tr>
        <td style="padding:18px 24px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#A12161;text-transform:uppercase;letter-spacing:1px;">
            As an admin you will be able to
          </p>
          ${[
            'Manage user accounts and roles',
            'Review and publish exam content',
            'Send broadcast email campaigns',
            'View platform analytics and reports',
          ]
            .map(
              (item) => /* html */ `
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:6px;">
            <tr>
              <td style="width:18px;vertical-align:top;padding-top:2px;color:#A12161;font-size:14px;">&#x2713;</td>
              <td style="padding-left:8px;font-size:14px;color:#444444;line-height:1.6;">${item}</td>
            </tr>
          </table>`,
            )
            .join('')}
        </td>
      </tr>
    </table>

    <!-- Expiry notice -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#FFFBEB;border-left:4px solid #F59E0B;border-radius:0 8px 8px 0;margin:0 0 28px;">
      <tr>
        <td style="padding:14px 20px;">
          <p style="margin:0;font-size:13px;color:#92400E;line-height:1.6;">
            <strong>Security Notice:</strong> This invitation link expires in&nbsp;<strong>7&nbsp;days</strong>.
            If you weren't expecting this, please disregard this email — no action is required.
          </p>
        </td>
      </tr>
    </table>

    ${signoff()}
  `;

  return {
    subject: `You're Invited to the iExcelo Admin Panel`,
    html: baseTemplate({ body, accentColor: '#A12161' }),
  };
}
