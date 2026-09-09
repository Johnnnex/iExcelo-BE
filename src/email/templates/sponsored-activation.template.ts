import { loadTemplate } from './load-template.util.js';

export function getSponsoredActivationEmailTemplate(params: {
  firstName: string;
  sponsorName: string;
  activationUrl: string;
}): { subject: string; html: string } {
  return {
    subject: 'You Have Been Sponsored on iExcelo',
    html: loadTemplate('04-sponsored-activation.html', {
      name: params.firstName,
      sponsorName: params.sponsorName,
      activationUrl: params.activationUrl,
    }),
  };
}
