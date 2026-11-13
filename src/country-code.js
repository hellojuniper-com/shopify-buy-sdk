import countryCodes from './country-codes.json';

// Shopify rejects the whole request for a country outside its `CountryCode` enum.
export function isCountryCode(value) {
  return countryCodes.indexOf(value) !== -1;
}

export function warnIgnoredCountry(option, value) {
  const shown = typeof value === 'string' ? `'${value}'` : typeof value;

  // eslint-disable-next-line no-console
  console.warn(`[ShopifyBuy] Ignoring ${option} ${shown}: not a Shopify CountryCode such as 'GB'.`);
}
