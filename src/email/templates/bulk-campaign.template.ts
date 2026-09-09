import { loadTemplate } from './load-template.util.js';
import { CampaignCategory } from '../../admin/entities/bulk-email-campaign.entity.js';

const CATEGORY_LABELS: Record<CampaignCategory, string> = {
  [CampaignCategory.NEWSLETTER]:     'Newsletter',
  [CampaignCategory.PROMOTIONS]:     'Promotions & Offers',
  [CampaignCategory.PRODUCT_UPDATES]:'Product Update',
  [CampaignCategory.SECURITY_ALERTS]:'Security Alert',
};

export function getBulkCampaignEmailTemplate(params: {
  firstName: string;
  htmlContent: string;
  category: CampaignCategory;
  settingsUrl: string;
}): { html: string } {
  const { firstName, htmlContent, category, settingsUrl } = params;
  const categoryLabel = CATEGORY_LABELS[category] ?? CATEGORY_LABELS[CampaignCategory.NEWSLETTER];

  return {
    html: loadTemplate('08-bulk-campaign.html', {
      name: firstName,
      categoryLabel,
      htmlContent,
      settingsUrl,
    }),
  };
}
