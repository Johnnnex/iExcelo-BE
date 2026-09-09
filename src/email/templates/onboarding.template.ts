import { loadTemplate } from './load-template.util.js';

export function getOnboardingEmailTemplate(params: {
  firstName: string;
  onboardingUrl: string;
}): { subject: string; html: string } {
  return {
    subject: 'Complete Your iExcelo Setup',
    html: loadTemplate('03-onboarding.html', {
      name: params.firstName,
      onboardingUrl: params.onboardingUrl,
    }),
  };
}
