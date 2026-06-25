import {
  baseTemplate,
  ctaButton,
  greeting,
  infoCard,
  signoff,
} from './base.template';

const USER_TYPE_META: Record<
  string,
  { label: string; tagline: string; accentColor: string; features: string[] }
> = {
  student: {
    label: 'Student',
    tagline: 'Your exam preparation journey starts now.',
    accentColor: '#007FFF',
    features: [
      'Thousands of past exam questions across multiple subjects',
      'Smart study paths tailored to your goals',
      'Real-time performance analytics and progress tracking',
      'Mock exams and timed practice sessions',
    ],
  },
  sponsor: {
    label: 'Sponsor',
    tagline: "Make a real difference in a student's future.",
    accentColor: '#099137',
    features: [
      'Create and manage sponsored student accounts',
      'Track the progress of students you support',
      'Access detailed performance reports',
      'Manage subscription and billing in one place',
    ],
  },
  affiliate: {
    label: 'Affiliate',
    tagline: 'Start earning by growing the iExcelo community.',
    accentColor: '#F3A218',
    features: [
      'Get a unique referral link to share with your network',
      'Earn commission on every successful referral',
      'Track your earnings and payouts in real time',
      'Access marketing materials in your affiliate dashboard',
    ],
  },
};

export function getWelcomeEmailTemplate(params: {
  firstName: string;
  lastName: string;
  userType?: string;
}): { subject: string; html: string } {
  const { firstName, lastName, userType } = params;
  const fullName = `${firstName} ${lastName}`;
  const meta = userType ? USER_TYPE_META[userType] : null;
  const accentColor = meta?.accentColor ?? '#007FFF';
  const dashboardUrl = `${process.env.FRONTEND_URL ?? 'https://iexcelo.com'}/dashboard`;

  const rolePill = meta
    ? /* html */ `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;">
      <tr>
        <td class="pill-bg" style="background-color:#F0F9FF;border-radius:20px;padding:6px 16px;">
          <span class="pill-text" style="font-size:13px;font-weight:700;color:${accentColor};letter-spacing:0.5px;">
            ${meta.label}
          </span>
        </td>
      </tr>
    </table>`
    : '';

  const featuresList = meta
    ? infoCard(
        /* html */ `
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:1px;">
        What you have access to
      </p>
      ${meta.features
        .map(
          (f) => /* html */ `
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px;">
        <tr>
          <td style="width:18px;vertical-align:top;padding-top:2px;color:${accentColor};font-size:14px;font-weight:700;">&#x2713;</td>
          <td style="padding-left:10px;font-size:14px;color:#444444;line-height:1.6;">${f}</td>
        </tr>
      </table>`,
        )
        .join('')}
    `,
        accentColor,
      )
    : '';

  const tagline = meta?.tagline ?? "We're thrilled to have you on board.";

  const body = /* html */ `
    ${greeting(fullName)}

    ${rolePill}

    <p class="body-sub" style="margin:0 0 8px;font-size:15px;color:#444444;line-height:1.75;">
      Welcome to iExcelo! ${tagline}
    </p>

    <p class="body-sub" style="margin:0 0 28px;font-size:15px;color:#444444;line-height:1.75;">
      Your account is live and everything is ready for you. Head to your dashboard to get started.
    </p>

    ${featuresList}

    ${ctaButton('Go to Dashboard', dashboardUrl, accentColor)}

    <p class="body-sub" style="margin:0 0 28px;font-size:14px;color:#667085;text-align:center;line-height:1.6;">
      Questions? Email us anytime at
      <a href="mailto:support@iexcelo.com" style="color:${accentColor};text-decoration:none;">support@iexcelo.com</a>
    </p>

    ${signoff()}
  `;

  return {
    subject: `Welcome to iExcelo, ${firstName}!`,
    html: baseTemplate({ body, accentColor }),
  };
}
