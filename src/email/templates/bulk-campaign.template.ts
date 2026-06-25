import { baseTemplate, signoff } from './base.template';
import { CampaignCategory } from '../../admin/entities/bulk-email-campaign.entity';

const CATEGORY_META: Record<
  CampaignCategory,
  { label: string; accentColor: string }
> = {
  [CampaignCategory.NEWSLETTER]: {
    label: 'Newsletter',
    accentColor: '#007FFF',
  },
  [CampaignCategory.PROMOTIONS]: {
    label: 'Promotions & Offers',
    accentColor: '#F3A218',
  },
  [CampaignCategory.PRODUCT_UPDATES]: {
    label: 'Product Update',
    accentColor: '#099137',
  },
  [CampaignCategory.SECURITY_ALERTS]: {
    label: 'Security Alert',
    accentColor: '#D42620',
  },
};

export function getBulkCampaignEmailTemplate(params: {
  firstName: string;
  htmlContent: string;
  category: CampaignCategory;
}): { html: string } {
  const { firstName, htmlContent, category } = params;
  const meta =
    CATEGORY_META[category] ?? CATEGORY_META[CampaignCategory.NEWSLETTER];

  const categoryPill = /* html */ `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 20px;">
      <tr>
        <td class="pill-bg" style="background-color:#f4f4f4;border-radius:20px;padding:5px 14px;border:1px solid #e0e0e0;">
          <span class="pill-label" style="font-size:12px;font-weight:700;color:${meta.accentColor};letter-spacing:0.8px;text-transform:uppercase;">
            ${meta.label}
          </span>
        </td>
      </tr>
    </table>
  `;

  const greeting = `<p class="body-text" style="margin:0 0 20px;font-size:16px;font-weight:600;color:#1a1a1a;line-height:1.75;">Hi ${firstName},</p>`;

  const body = /* html */ `
    ${greeting}

    ${categoryPill}

    <!-- Admin-composed content -->
    <div class="body-sub" style="font-size:15px;color:#444444;line-height:1.8;">
      ${htmlContent}
    </div>

    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:32px 0 24px;">
      <tr><td class="divider" style="border-top:1px solid #F2F4F7;font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>

    <p class="body-sub" style="margin:0;font-size:13px;color:#98A2B3;line-height:1.6;">
      You're receiving this email because you have an active iExcelo account and opted into
      <strong>${meta.label}</strong> emails.
      Visit your
      <a href="${process.env.FRONTEND_URL ?? 'https://iexcelo.com'}/student/settings/notification" style="color:${meta.accentColor};text-decoration:none;">notification settings</a>
      to manage your email preferences.
    </p>

    ${signoff()}
  `;

  return {
    html: baseTemplate({ body, accentColor: meta.accentColor }),
  };
}
