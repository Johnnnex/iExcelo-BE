import { loadTemplate } from './load-template.util.js';

const FILE_MAP: Record<string, string> = {
  student:   '07a-welcome-student.html',
  sponsor:   '07b-welcome-sponsor.html',
  affiliate: '07c-welcome-affiliate.html',
};

export function getWelcomeEmailTemplate(params: {
  firstName: string;
  userType?: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const { firstName, userType, dashboardUrl } = params;
  const file = (userType && FILE_MAP[userType]) ?? FILE_MAP.student;

  return {
    subject: `Welcome to iExcelo, ${firstName}!`,
    html: loadTemplate(file, { name: firstName, dashboardUrl }),
  };
}
