import { Currency, PaymentProvider } from '../../../types';

export const regionsData = [
  // Nigeria - Paystack
  {
    regionCode: 'NG',
    regionName: 'Nigeria',
    currency: Currency.NGN,
    paymentProvider: PaymentProvider.PAYSTACK,
  },
  // United States - Stripe
  {
    regionCode: 'US',
    regionName: 'United States',
    currency: Currency.USD,
    paymentProvider: PaymentProvider.STRIPE,
  },
  // United Kingdom - Stripe
  {
    regionCode: 'GB',
    regionName: 'United Kingdom',
    currency: Currency.GBP,
    paymentProvider: PaymentProvider.STRIPE,
  },
  // Canada - Stripe
  {
    regionCode: 'CA',
    regionName: 'Canada',
    currency: Currency.CAD,
    paymentProvider: PaymentProvider.STRIPE,
  },
  // Australia - Stripe (USD)
  {
    regionCode: 'AU',
    regionName: 'Australia',
    currency: Currency.USD,
    paymentProvider: PaymentProvider.STRIPE,
  },
  // Europe (common countries) - Stripe
  {
    regionCode: 'DE',
    regionName: 'Germany',
    currency: Currency.EUR,
    paymentProvider: PaymentProvider.STRIPE,
  },
  {
    regionCode: 'FR',
    regionName: 'France',
    currency: Currency.EUR,
    paymentProvider: PaymentProvider.STRIPE,
  },
  {
    regionCode: 'NL',
    regionName: 'Netherlands',
    currency: Currency.EUR,
    paymentProvider: PaymentProvider.STRIPE,
  },
  {
    regionCode: 'IE',
    regionName: 'Ireland',
    currency: Currency.EUR,
    paymentProvider: PaymentProvider.STRIPE,
  },
  // African countries (Paystack supported)
  {
    regionCode: 'GH',
    regionName: 'Ghana',
    currency: Currency.USD,
    paymentProvider: PaymentProvider.PAYSTACK,
  },
  {
    regionCode: 'KE',
    regionName: 'Kenya',
    currency: Currency.USD,
    paymentProvider: PaymentProvider.PAYSTACK,
  },
  {
    regionCode: 'ZA',
    regionName: 'South Africa',
    currency: Currency.USD,
    paymentProvider: PaymentProvider.PAYSTACK,
  },
];

// Default region for unknown locations
export const defaultRegion = {
  regionCode: 'DEFAULT',
  regionName: 'International',
  currency: Currency.USD,
  paymentProvider: PaymentProvider.STRIPE,
};
