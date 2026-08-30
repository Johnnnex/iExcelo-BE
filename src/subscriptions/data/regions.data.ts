import { Currency } from '../../../types';

export const regionsData = [
  { regionCode: 'NG', regionName: 'Nigeria', currency: Currency.NGN },
  { regionCode: 'US', regionName: 'United States', currency: Currency.USD },
  { regionCode: 'GB', regionName: 'United Kingdom', currency: Currency.GBP },
  { regionCode: 'CA', regionName: 'Canada', currency: Currency.CAD },
  { regionCode: 'AU', regionName: 'Australia', currency: Currency.AUD },
  { regionCode: 'DE', regionName: 'Germany', currency: Currency.EUR },
  { regionCode: 'FR', regionName: 'France', currency: Currency.EUR },
  { regionCode: 'NL', regionName: 'Netherlands', currency: Currency.EUR },
  { regionCode: 'IE', regionName: 'Ireland', currency: Currency.EUR },
  { regionCode: 'ES', regionName: 'Spain', currency: Currency.EUR },
  { regionCode: 'IT', regionName: 'Italy', currency: Currency.EUR },
  { regionCode: 'GH', regionName: 'Ghana', currency: Currency.GHS },
  { regionCode: 'KE', regionName: 'Kenya', currency: Currency.KES },
  { regionCode: 'ZA', regionName: 'South Africa', currency: Currency.ZAR },
  { regionCode: 'UG', regionName: 'Uganda', currency: Currency.UGX },
  { regionCode: 'TZ', regionName: 'Tanzania', currency: Currency.TZS },
  { regionCode: 'BJ', regionName: 'Benin', currency: Currency.XOF },
  { regionCode: 'CI', regionName: "Côte d'Ivoire", currency: Currency.XOF },
  { regionCode: 'SN', regionName: 'Senegal', currency: Currency.XOF },
  { regionCode: 'CM', regionName: 'Cameroon', currency: Currency.XAF },
  { regionCode: 'LR', regionName: 'Liberia', currency: Currency.LRD },
  { regionCode: 'GM', regionName: 'Gambia', currency: Currency.GMD },
  { regionCode: 'SL', regionName: 'Sierra Leone', currency: Currency.SLE },
  { regionCode: 'CD', regionName: 'DR Congo', currency: Currency.CDF },
  { regionCode: 'MZ', regionName: 'Mozambique', currency: Currency.MZN },
  { regionCode: 'NA', regionName: 'Namibia', currency: Currency.NAD },
];

export const defaultRegion = {
  regionCode: 'DEFAULT',
  regionName: 'International',
  currency: Currency.USD,
};
