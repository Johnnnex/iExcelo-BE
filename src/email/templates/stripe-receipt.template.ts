import { loadTemplate } from './load-template.util.js';

export function getStripeReceiptEmailTemplate(params: {
  firstName: string;
  amount: number;
  currency: string;
  cardBrand: string;
  cardLast4: string;
  receiptUrl: string;
}): { subject: string; html: string } {
  const { firstName, amount, currency, cardBrand, cardLast4, receiptUrl } = params;

  const currencyUpper = currency.toUpperCase();
  const amountFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyUpper,
  }).format(amount / 100);

  const brandDisplay = cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1).toLowerCase();

  return {
    subject: `Payment Receipt — ${amountFormatted} from iExcelo`,
    html: loadTemplate('09-stripe-receipt.html', {
      name: firstName,
      amountFormatted,
      currencyUpper,
      cardBrand: brandDisplay,
      cardLast4,
      receiptUrl,
    }),
  };
}
