import {
  baseTemplate,
  ctaButton,
  fallbackLink,
  greeting,
  signoff,
} from './base.template';

export function getStripeReceiptEmailTemplate(params: {
  firstName: string;
  amount: number;
  currency: string;
  cardBrand: string;
  cardLast4: string;
  receiptUrl: string;
}): { subject: string; html: string } {
  const { firstName, amount, currency, cardBrand, cardLast4, receiptUrl } =
    params;

  const currencyUpper = currency.toUpperCase();
  const amountFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyUpper,
  }).format(amount / 100);

  const brandDisplay =
    cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1).toLowerCase();

  // Centred amount pill — same pattern as the OTP block in verification.template.ts
  const amountBlock = /* html */ `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
      <tr>
        <td align="center">
          <div style="display:inline-block;background-color:#E8F5EC;border:1.5px solid #A3D9B1;border-radius:12px;padding:28px 56px;">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#099137;text-transform:uppercase;letter-spacing:2px;">Amount Paid</p>
            <p style="margin:0;font-size:40px;font-weight:800;color:#099137;line-height:1;">${amountFormatted}</p>
          </div>
        </td>
      </tr>
    </table>
  `;

  // Details table directly in the white body — uses body-sub / body-strong classes
  // so dark-mode text inversion happens against the body bg, not an info-card bg.
  const detailsTable = /* html */ `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
      <tr>
        <td style="padding:14px 0;border-top:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td class="body-sub" style="font-size:13px;color:#667085;">Card used</td>
              <td align="right" class="body-strong" style="font-size:13px;font-weight:600;color:#1a1a1a;">${brandDisplay} •••• ${cardLast4}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td class="body-sub" style="font-size:13px;color:#667085;">Status</td>
              <td align="right">
                <span style="display:inline-block;background-color:#E8F5EC;color:#099137;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Paid</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td class="body-sub" style="font-size:13px;color:#667085;">Currency</td>
              <td align="right" class="body-strong" style="font-size:13px;font-weight:600;color:#1a1a1a;">${currencyUpper}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const body = /* html */ `
    ${greeting(firstName)}

    <p class="body-sub" style="margin:0 0 24px;font-size:15px;color:#444444;line-height:1.75;">
      Your payment was processed successfully. Here's a summary — tap the button below to view your full Stripe receipt.
    </p>

    ${amountBlock}

    ${detailsTable}

    ${ctaButton('View Full Receipt', receiptUrl, '#099137')}

    ${fallbackLink(receiptUrl)}

    ${signoff()}
  `;

  return {
    subject: `Payment Receipt — ${amountFormatted} from iExcelo`,
    html: baseTemplate({ body, accentColor: '#099137' }),
  };
}
