import {
  baseTemplate,
  ctaButton,
  fallbackLink,
  greeting,
  infoCard,
  signoff,
} from './base.template';

export function getSponsoredActivationEmailTemplate(params: {
  firstName: string;
  sponsorName: string;
  activationUrl: string;
}): { subject: string; html: string } {
  const { firstName, sponsorName, activationUrl } = params;

  const sponsorCard = infoCard(/* html */ `
    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#007FFF;text-transform:uppercase;letter-spacing:1px;">Sponsored by</p>
    <p style="margin:0;font-size:16px;font-weight:700;color:#1a1a1a;">${sponsorName}</p>
  `);

  const steps = /* html */ `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
      <tr>
        <td style="padding:0 0 10px;">
          <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#667085;text-transform:uppercase;letter-spacing:1px;">What to do next</p>
        </td>
      </tr>
      ${[
        'Click the activation button below',
        'Set a secure password for your new account',
        'Log in and begin your exam preparation journey',
      ]
        .map(
          (step, i) => /* html */ `
      <tr>
        <td style="padding:6px 0;">
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="width:28px;vertical-align:top;padding-top:1px;">
                <div style="width:22px;height:22px;background-color:#099137;border-radius:50%;text-align:center;line-height:22px;">
                  <span style="color:#fff;font-size:11px;font-weight:800;">${i + 1}</span>
                </div>
              </td>
              <td style="padding-left:10px;font-size:14px;color:#444444;line-height:1.6;">${step}</td>
            </tr>
          </table>
        </td>
      </tr>`,
        )
        .join('')}
    </table>
  `;

  const body = /* html */ `
    ${greeting(firstName)}

    <p class="body-sub" style="margin:0 0 20px;font-size:15px;color:#444444;line-height:1.75;">
      Great news! <strong>${sponsorName}</strong> has created an iExcelo account for you and is sponsoring
      your exam preparation. Your account is ready — activate it now to get started.
    </p>

    ${sponsorCard}

    ${ctaButton('Activate My Account', activationUrl, '#099137')}

    ${fallbackLink(activationUrl)}

    ${steps}

    <!-- Expiry notice -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#FFFBEB;border-left:4px solid #F59E0B;border-radius:0 8px 8px 0;margin:0 0 28px;">
      <tr>
        <td style="padding:14px 20px;">
          <p style="margin:0;font-size:13px;color:#92400E;line-height:1.6;">
            <strong>Security Notice:</strong> This activation link expires in&nbsp;<strong>7 days</strong>.
            If you weren't expecting this email, you can safely ignore it.
          </p>
        </td>
      </tr>
    </table>

    ${signoff()}
  `;

  return {
    subject: `You've Been Sponsored on iExcelo — Activate Your Account`,
    html: baseTemplate({ body, accentColor: '#099137' }),
  };
}
