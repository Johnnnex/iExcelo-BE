import {
  baseTemplate,
  ctaButton,
  fallbackLink,
  greeting,
  infoCard,
  signoff,
} from './base.template';

export function getOnboardingEmailTemplate(params: {
  firstName: string;
  lastName: string;
  onboardingUrl: string;
}): { subject: string; html: string } {
  const { firstName, lastName, onboardingUrl } = params;

  const steps = infoCard(/* html */ `
    <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#007FFF;text-transform:uppercase;letter-spacing:1px;">
      What happens next
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
      <tr>
        <td style="padding:6px 0;">
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="width:28px;vertical-align:top;padding-top:2px;">
                <div style="width:22px;height:22px;background-color:#007FFF;border-radius:50%;text-align:center;line-height:22px;">
                  <span style="color:#fff;font-size:11px;font-weight:800;">1</span>
                </div>
              </td>
              <td style="padding-left:10px;font-size:14px;color:#444444;line-height:1.6;">Click the button below to open your setup page</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0;">
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="width:28px;vertical-align:top;padding-top:2px;">
                <div style="width:22px;height:22px;background-color:#007FFF;border-radius:50%;text-align:center;line-height:22px;">
                  <span style="color:#fff;font-size:11px;font-weight:800;">2</span>
                </div>
              </td>
              <td style="padding-left:10px;font-size:14px;color:#444444;line-height:1.6;">Choose your account type and set your preferences</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0;">
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="width:28px;vertical-align:top;padding-top:2px;">
                <div style="width:22px;height:22px;background-color:#007FFF;border-radius:50%;text-align:center;line-height:22px;">
                  <span style="color:#fff;font-size:11px;font-weight:800;">3</span>
                </div>
              </td>
              <td style="padding-left:10px;font-size:14px;color:#444444;line-height:1.6;">Start your learning journey on iExcelo</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `);

  const body = /* html */ `
    ${greeting(`${firstName} ${lastName}`)}

    <p class="body-sub" style="margin:0 0 8px;font-size:15px;color:#444444;line-height:1.75;">
      Thanks for signing in with Google! Your iExcelo account is almost ready —
      you just need to complete a quick setup to unlock your personalised dashboard.
    </p>

    <p class="body-sub" style="margin:0 0 28px;font-size:15px;color:#444444;line-height:1.75;">
      It only takes a minute.
    </p>

    ${ctaButton('Complete My Setup', onboardingUrl)}

    ${fallbackLink(onboardingUrl)}

    ${steps}

    ${signoff()}
  `;

  return {
    subject: 'Complete Your iExcelo Setup – One Step Away',
    html: baseTemplate({ body }),
  };
}
