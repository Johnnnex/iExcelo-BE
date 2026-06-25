import {
  baseTemplate,
  ctaButton,
  fallbackLink,
  greeting,
  signoff,
} from './base.template';

export function getPasswordResetEmailTemplate(params: { resetUrl: string }): {
  subject: string;
  html: string;
} {
  const { resetUrl } = params;

  const body = /* html */ `
    ${greeting('there')}

    <p class="body-sub" style="margin:0 0 20px;font-size:15px;color:#444444;line-height:1.75;">
      We received a request to reset the password for your iExcelo account.
      Click the button below to set a new password — this link is valid for&nbsp;<strong>1&nbsp;hour</strong>.
    </p>

    ${ctaButton('Reset My Password', resetUrl)}

    ${fallbackLink(resetUrl)}

    <!-- Security notice -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#FFFBEB;border-left:4px solid #F59E0B;border-radius:0 8px 8px 0;margin:0 0 28px;">
      <tr>
        <td style="padding:14px 20px;">
          <p style="margin:0;font-size:13px;color:#92400E;line-height:1.6;">
            <strong>Didn't request this?</strong> Your account is safe — someone may have accidentally typed your email.
            If you didn't request a password reset you can safely ignore this email and your password will remain unchanged.
          </p>
        </td>
      </tr>
    </table>

    ${signoff()}
  `;

  return {
    subject: 'Reset Your Password – iExcelo',
    html: baseTemplate({ body }),
  };
}
