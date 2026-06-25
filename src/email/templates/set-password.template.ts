import { baseTemplate, greeting, signoff } from './base.template';

export function getSetPasswordEmailTemplate(params: {
  firstName: string;
  code: string;
}): { subject: string; html: string } {
  const { firstName, code } = params;

  const body = /* html */ `
    ${greeting(firstName)}

    <p class="body-sub" style="margin:0 0 16px;font-size:15px;color:#444444;line-height:1.75;">
      You requested to set a password for your iExcelo account.
      Use the code below to verify your identity — it expires in&nbsp;<strong>15&nbsp;minutes</strong>.
    </p>

    <!-- OTP block -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0;">
      <tr>
        <td align="center">
          <div style="display:inline-block;background-color:#EFF8FF;border:1.5px solid #B2D4FF;border-radius:12px;padding:24px 40px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#007FFF;text-transform:uppercase;letter-spacing:2px;">Verification Code</p>
            <p style="margin:0;font-size:38px;font-weight:800;letter-spacing:10px;color:#007FFF;">${code}</p>
          </div>
        </td>
      </tr>
    </table>

    <p class="body-sub" style="margin:0 0 28px;font-size:14px;color:#667085;text-align:center;line-height:1.6;">
      Enter this code on the password setup page in your iExcelo settings.
    </p>

    <!-- Warning notice -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#FFFBEB;border-left:4px solid #F59E0B;border-radius:0 8px 8px 0;margin:0 0 28px;">
      <tr>
        <td style="padding:14px 20px;">
          <p style="margin:0;font-size:13px;color:#92400E;line-height:1.6;">
            <strong>Didn't request this?</strong> If you didn't initiate a password setup
            from your account settings, someone may have access to your account.
            Contact us at <a href="mailto:security@iexcelo.com" style="color:#007FFF;text-decoration:none;">security@iexcelo.com</a> immediately.
          </p>
        </td>
      </tr>
    </table>

    ${signoff()}
  `;

  return {
    subject: 'Set Your Password – iExcelo Verification Code',
    html: baseTemplate({ body }),
  };
}
