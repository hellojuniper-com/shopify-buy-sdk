import { describe, it, expect } from '@jest/globals';

const countryCodes: string[] = require('../../src/country-codes.json');
const schema = require('../../schema.json');

describe('src/country-codes.json', () => {
  it('lists exactly the CountryCode enum of schema.json (regenerate with npm run schema:country-codes)', () => {
    const countryCode = schema.data.__schema.types.find((type: { name: string }) => type.name === 'CountryCode');

    expect(countryCodes).toEqual(countryCode.enumValues.map((value: { name: string }) => value.name));
    expect(countryCodes.filter((code) => !/^[A-Z]{2}$/.test(code))).toEqual([]);
  });
});
