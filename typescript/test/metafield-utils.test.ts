import { describe, it, expect } from '@jest/globals';
import {
  isMetafieldReferenceMetaobject,
  validateDate,
  getFieldValue,
  getBooleanValue,
  convertToDayRange
} from '../src/metafield-utils';
import { Metafield, MetafieldReference, MetafieldReferenceMetaobject, MetaobjectField } from '../shared/types';

describe('isMetafieldReferenceMetaobject', () => {
  it('should return true for MetafieldReferenceMetaobject with fields', () => {
    const ref: MetafieldReferenceMetaobject = {
      id: 'gid://shopify/Metaobject/123',
      fields: [
        { key: 'test', value: 'value', type: 'string', reference: null }
      ]
    };
    expect(isMetafieldReferenceMetaobject(ref)).toBe(true);
  });

  it('should return true for MetafieldReferenceMetaobject with empty fields array', () => {
    const ref: MetafieldReferenceMetaobject = {
      id: 'gid://shopify/Metaobject/123',
      fields: []
    };
    expect(isMetafieldReferenceMetaobject(ref)).toBe(true);
  });

  it('should return false for MetafieldReference without fields', () => {
    const ref: MetafieldReference = {
      id: 'gid://shopify/Product/123'
    };
    expect(isMetafieldReferenceMetaobject(ref)).toBe(false);
  });
});

describe('validateDate', () => {
  describe('null input', () => {
    it('should return null when input is null', () => {
      const result = validateDate(null, 'orderCutoffDate');
      expect(result).toBeNull();
    });
  });

  describe('valid date strings', () => {
    it('should parse valid ISO date string', () => {
      const result = validateDate('2025-01-15', 'orderCutoffDate');
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2025-01-15T00:00:00.000Z');
    });

    it('should parse valid date-time string with timezone', () => {
      const result = validateDate('2025-01-15T10:30:00Z', 'estimatedShippingDate');
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2025-01-15T10:30:00.000Z');
    });

    it('should parse valid date-time string with offset', () => {
      const result = validateDate('2025-01-15T10:30:00-05:00', 'orderCutoffDate');
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2025-01-15T15:30:00.000Z');
    });

    it('should parse date string in various formats', () => {
      const result = validateDate('01/15/2025', 'orderCutoffDate');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(0);
      expect(result?.getDate()).toBe(15);
    });
  });

  describe('invalid date strings', () => {
    it('should throw error for invalid date string', () => {
      expect(() => validateDate('not-a-date', 'orderCutoffDate')).toThrow(
        'Invalid orderCutoffDate: not-a-date'
      );
    });

    it('should throw error for empty string', () => {
      expect(() => validateDate('', 'estimatedShippingDate')).toThrow(
        'Invalid estimatedShippingDate: '
      );
    });

    it('should throw error for malformed date', () => {
      expect(() => validateDate('2025-13-45', 'orderCutoffDate')).toThrow(
        'Invalid orderCutoffDate: 2025-13-45'
      );
    });

    it('should include field name in error message', () => {
      expect(() => validateDate('invalid', 'customFieldName')).toThrow(
        'Invalid customFieldName: invalid'
      );
    });
  });
});

describe('getFieldValue', () => {
  describe('field exists', () => {
    it('should return value when field exists with string value', () => {
      const fields: MetaobjectField[] = [
        { key: 'orderCutoffDate', value: '2025-01-15', type: 'date', reference: null },
        { key: 'estimatedShippingDate', value: '2025-02-01', type: 'date', reference: null }
      ];
      const result = getFieldValue(fields, 'orderCutoffDate');
      expect(result).toBe('2025-01-15');
    });

    it('should return null when field exists with null value', () => {
      const fields: MetaobjectField[] = [
        { key: 'orderCutoffDate', value: null, type: 'date', reference: null },
        { key: 'estimatedShippingDate', value: '2025-02-01', type: 'date', reference: null }
      ];
      const result = getFieldValue(fields, 'orderCutoffDate');
      expect(result).toBeNull();
    });

    it('should return correct value when multiple fields exist', () => {
      const fields: MetaobjectField[] = [
        { key: 'field1', value: 'value1', type: 'string', reference: null },
        { key: 'field2', value: 'value2', type: 'string', reference: null },
        { key: 'field3', value: 'value3', type: 'string', reference: null }
      ];
      const result = getFieldValue(fields, 'field2');
      expect(result).toBe('value2');
    });

    it('should match keys case-sensitively', () => {
      const fields: MetaobjectField[] = [
        { key: 'orderCutoffDate', value: 'lowercase', type: 'string', reference: null },
        { key: 'OrderCutoffDate', value: 'uppercase', type: 'string', reference: null }
      ];
      const result = getFieldValue(fields, 'orderCutoffDate');
      expect(result).toBe('lowercase');
    });
  });

  describe('field does not exist', () => {
    it('should return null when field key does not exist', () => {
      const fields: MetaobjectField[] = [
        { key: 'someOtherField', value: 'value', type: 'string', reference: null }
      ];
      const result = getFieldValue(fields, 'orderCutoffDate');
      expect(result).toBeNull();
    });

    it('should return null when array is empty', () => {
      const fields: MetaobjectField[] = [];
      const result = getFieldValue(fields, 'orderCutoffDate');
      expect(result).toBeNull();
    });

    it('should return null when searching for non-existent key', () => {
      const fields: MetaobjectField[] = [
        { key: 'field1', value: 'value1', type: 'string', reference: null },
        { key: 'field2', value: 'value2', type: 'string', reference: null }
      ];
      const result = getFieldValue(fields, 'nonExistentKey');
      expect(result).toBeNull();
    });
  });
});

describe('getBooleanValue', () => {
  describe('with valid metafield', () => {
    it('should return true for "true" string value', () => {
      const metafield: Metafield = {
        id: 'gid://shopify/Metafield/123',
        namespace: 'custom',
        key: 'isFulfillingFromUS',
        type: 'boolean',
        value: 'true',
        reference: null,
        references: null
      };
      expect(getBooleanValue(metafield)).toBe(true);
    });

    it('should return true for "True" string value (mixed case)', () => {
      const metafield: Metafield = {
        id: 'gid://shopify/Metafield/123',
        namespace: 'custom',
        key: 'isFulfillingFromUS',
        type: 'boolean',
        value: 'True',
        reference: null,
        references: null
      };
      expect(getBooleanValue(metafield)).toBe(true);
    });

    it('should return true for "TRUE" string value (uppercase)', () => {
      const metafield: Metafield = {
        id: 'gid://shopify/Metafield/123',
        namespace: 'custom',
        key: 'isFulfillingFromUS',
        type: 'boolean',
        value: 'TRUE',
        reference: null,
        references: null
      };
      expect(getBooleanValue(metafield)).toBe(true);
    });

    it('should return false for "false" string value', () => {
      const metafield: Metafield = {
        id: 'gid://shopify/Metafield/123',
        namespace: 'custom',
        key: 'isFulfillingFromUS',
        type: 'boolean',
        value: 'false',
        reference: null,
        references: null
      };
      expect(getBooleanValue(metafield)).toBe(false);
    });

    it('should return false for any non-"true" string value', () => {
      const metafield: Metafield = {
        id: 'gid://shopify/Metafield/123',
        namespace: 'custom',
        key: 'isFulfillingFromUS',
        type: 'boolean',
        value: 'yes',
        reference: null,
        references: null
      };
      expect(getBooleanValue(metafield)).toBe(false);
    });

    it('should return false for empty string value', () => {
      const metafield: Metafield = {
        id: 'gid://shopify/Metafield/123',
        namespace: 'custom',
        key: 'isFulfillingFromUS',
        type: 'boolean',
        value: '',
        reference: null,
        references: null
      };
      expect(getBooleanValue(metafield)).toBe(false);
    });
  });

  describe('with null metafield', () => {
    it('should return false when metafield is null', () => {
      expect(getBooleanValue(null)).toBe(false);
    });
  });

  describe('with null value', () => {
    it('should return false when metafield value is null', () => {
      const metafield: Metafield = {
        id: 'gid://shopify/Metafield/123',
        namespace: 'custom',
        key: 'isFulfillingFromUS',
        type: 'boolean',
        value: null,
        reference: null,
        references: null
      };
      expect(getBooleanValue(metafield)).toBe(false);
    });
  });
});

describe('convertToDayRange', () => {
  describe('valid input', () => {
    it('should parse "1-3 business days"', () => {
      const result = convertToDayRange('1-3 business days');
      expect(result).toEqual({ minDays: 1, maxDays: 3 });
    });

    it('should parse "1 - 3 business days" with spaces', () => {
      const result = convertToDayRange('1 - 3 business days');
      expect(result).toEqual({ minDays: 1, maxDays: 3 });
    });

    it('should parse "7-14 business days"', () => {
      const result = convertToDayRange('7-14 business days');
      expect(result).toEqual({ minDays: 7, maxDays: 14 });
    });

    it('should parse "5–10 days" with en-dash', () => {
      const result = convertToDayRange('5–10 days');
      expect(result).toEqual({ minDays: 5, maxDays: 10 });
    });

    it('should parse "5—10 days" with em-dash', () => {
      const result = convertToDayRange('5—10 days');
      expect(result).toEqual({ minDays: 5, maxDays: 10 });
    });

    it('should parse range with extra spaces around dash', () => {
      const result = convertToDayRange('2  -  5 business days');
      expect(result).toEqual({ minDays: 2, maxDays: 5 });
    });

    it('should parse range without "business days" suffix', () => {
      const result = convertToDayRange('3-7');
      expect(result).toEqual({ minDays: 3, maxDays: 7 });
    });

    it('should parse multi-digit ranges', () => {
      const result = convertToDayRange('10-20 business days');
      expect(result).toEqual({ minDays: 10, maxDays: 20 });
    });

    it('should parse ranges with additional text', () => {
      const result = convertToDayRange('Processing time: 1-3 business days');
      expect(result).toEqual({ minDays: 1, maxDays: 3 });
    });
  });

  describe('invalid input', () => {
    it('should return null for null input', () => {
      const result = convertToDayRange(null);
      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      const result = convertToDayRange(undefined);
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = convertToDayRange('');
      expect(result).toBeNull();
    });

    it('should return null for single number', () => {
      const result = convertToDayRange('5 days');
      expect(result).toBeNull();
    });

    it('should return null for non-numeric range', () => {
      const result = convertToDayRange('one-three days');
      expect(result).toBeNull();
    });

    it('should return null for string without range', () => {
      const result = convertToDayRange('business days');
      expect(result).toBeNull();
    });

    it('should return null for invalid format', () => {
      const result = convertToDayRange('5 to 10 days');
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should parse range where min equals max', () => {
      const result = convertToDayRange('5-5 days');
      expect(result).toEqual({ minDays: 5, maxDays: 5 });
    });

    it('should parse range with zero', () => {
      const result = convertToDayRange('0-3 days');
      expect(result).toEqual({ minDays: 0, maxDays: 3 });
    });

    it('should parse first occurrence when multiple ranges exist', () => {
      const result = convertToDayRange('Processing: 1-3 days, Delivery: 5-7 days');
      expect(result).toEqual({ minDays: 1, maxDays: 3 });
    });
  });
});
