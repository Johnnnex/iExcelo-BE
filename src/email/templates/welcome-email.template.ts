export function getWelcomeEmailTemplate(params: {
  firstName: string;
  lastName: string;
  userType?: string;
}) {
  const { firstName, lastName, userType } = params;
  const fullName = `${firstName} ${lastName}`;

  return {
    subject: 'Welcome to iExcelo! 🎉',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #007FFF; margin-bottom: 20px;">Welcome to iExcelo, ${fullName}! 🎉</h1>
        
        <p style="font-size: 16px; line-height: 1.6; color: #333;">
          We're thrilled to have you join our community! Your journey to academic excellence starts here.
        </p>

        ${
          userType === 'student'
            ? `
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            As a student, you now have access to:
          </p>
          <ul style="font-size: 16px; line-height: 1.8; color: #333;">
            <li>Thousands of past exam questions</li>
            <li>Smart study paths tailored to your goals</li>
            <li>Real-time performance analytics</li>
            <li>Mock exams and timed practice sessions</li>
          </ul>
        `
            : userType === 'sponsor'
              ? `
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            As a sponsor, you can now make a meaningful impact by supporting students in their educational journey.
          </p>
        `
              : userType === 'affiliate'
                ? `
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            As an affiliate, you can start earning by referring students and sponsors to our platform.
          </p>
        `
                : ''
        }

        <p style="font-size: 16px; line-height: 1.6; color: #333; margin-top: 30px;">
          Ready to get started? Log in to your dashboard and explore all the features we have to offer.
        </p>

        <div style="margin: 30px 0; text-align: center;">
          <a href="${process.env.FRONTEND_URL || 'https://iexcelo.com'}/login" 
             style="background-color: #007FFF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
            Go to Dashboard
          </a>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #666; margin-top: 30px;">
          If you have any questions, feel free to reach out to our support team. We're here to help!
        </p>

        <p style="font-size: 14px; line-height: 1.6; color: #666;">
          Best regards,<br>
          The iExcelo Team
        </p>
      </div>
    `,
  };
}
