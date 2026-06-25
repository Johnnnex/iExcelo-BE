import { baseTemplate, greeting, signoff } from './base.template';

export function getVerificationEmailTemplate(params: {
  verificationCode: string;
}): { subject: string; html: string } {
  const { verificationCode } = params;

  const body = /* html */ `
    ${greeting('there')}

    <p class="body-sub" style="margin:0 0 12px;font-size:15px;font-weight:400;color:#444444;line-height:1.75;">
      Welcome to iExcelo! Use the code below to verify your email address and activate your account.
    </p>

    <!-- OTP block -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0;">
      <tr>
        <td align="center">
          <div style="display:inline-block;background-color:#EFF8FF;border:1.5px solid #B2D4FF;border-radius:12px;padding:24px 40px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#007FFF;text-transform:uppercase;letter-spacing:2px;">Verification Code</p>
            <p style="margin:0;font-size:38px;font-weight:800;letter-spacing:10px;color:#007FFF;">${verificationCode}</p>
          </div>
        </td>
      </tr>
    </table>

    <p class="body-sub" style="margin:0 0 8px;font-size:14px;color:#667085;text-align:center;line-height:1.6;">
      Enter this code on the verification page to continue.
    </p>

    <!-- Security notice -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#FFFBEB;border-left:4px solid #F59E0B;border-radius:0 8px 8px 0;margin:28px 0;">
      <tr>
        <td style="padding:14px 20px;">
          <p style="margin:0;font-size:13px;color:#92400E;line-height:1.6;">
            <strong>Security Notice:</strong> This verification code expires in 24 hours.
            If you didn't create an account with iExcelo, you can safely ignore this email.
          </p>
        </td>
      </tr>
    </table>

    ${signoff()}
  `;

  return {
    subject: 'Verify Your Email – iExcelo',
    html: baseTemplate({ body }),
  };
}
