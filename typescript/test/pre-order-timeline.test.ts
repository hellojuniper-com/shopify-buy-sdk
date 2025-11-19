import { describe, it, expect, jest } from '@jest/globals';
import { __testing__, PreOrderBatch, PreOrderTimeline } from '../src/pre-order-timeline';
import { Metafield, MetafieldReferenceMetaobject, MetaobjectField } from '../shared/types';
import { validateDate, getFieldValue } from '../src/metafield-utils';

const { parseMetaobjectFieldList, deduplicateOpenEndedBatches, sortBatchesByOrderCutoffDate } = __testing__;

// Helper function to create a Metafield with metaobject references for testing
function createMetaobjectList(batches: Array<{ cutoff: string | null, shipping: string }>): Metafield {
  return {
    id: 'gid://shopify/Metafield/123',
    namespace: 'custom',
    key: 'pre_order_timeline',
    type: 'list.metaobject_reference',
    value: 'gid://shopify/Metaobject/123',
    reference: null,
    references: batches.map(batch => ({
      id: `gid://shopify/Metaobject/${Math.random()}`,
      fields: [
        ...(batch.cutoff ? [{ key: 'orderCutoffDate', value: batch.cutoff, type: 'date', reference: null }] : []),
        { key: 'estimatedShippingDate', value: batch.shipping, type: 'date', reference: null }
      ] as MetaobjectField[]
    })) as MetafieldReferenceMetaobject[]
  };
}

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
      // The result should be converted to UTC
      expect(result?.toISOString()).toBe('2025-01-15T15:30:00.000Z');
    });

    it('should parse date string in various formats', () => {
      const result = validateDate('01/15/2025', 'orderCutoffDate');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(0); // January is 0
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

    it('should include date value in error message', () => {
      expect(() => validateDate('totally-invalid-date', 'orderCutoffDate')).toThrow(
        'Invalid orderCutoffDate: totally-invalid-date'
      );
    });
  });
});

describe('getFieldValue', () => {
  describe('field exists', () => {
    it('should return value when field exists with string value', () => {
      const fields = [
        { key: 'orderCutoffDate', value: '2025-01-15', type: 'date', reference: null },
        { key: 'estimatedShippingDate', value: '2025-02-01', type: 'date', reference: null }
      ];
      const result = getFieldValue(fields, 'orderCutoffDate');
      expect(result).toBe('2025-01-15');
    });

    it('should return null when field exists with null value', () => {
      const fields = [
        { key: 'orderCutoffDate', value: null, type: 'date', reference: null },
        { key: 'estimatedShippingDate', value: '2025-02-01', type: 'date', reference: null }
      ];
      const result = getFieldValue(fields, 'orderCutoffDate');
      expect(result).toBeNull();
    });

    it('should return correct value when multiple fields exist', () => {
      const fields = [
        { key: 'field1', value: 'value1', type: 'string', reference: null },
        { key: 'field2', value: 'value2', type: 'string', reference: null },
        { key: 'field3', value: 'value3', type: 'string', reference: null }
      ];
      const result = getFieldValue(fields, 'field2');
      expect(result).toBe('value2');
    });

    it('should match keys case-sensitively', () => {
      const fields = [
        { key: 'orderCutoffDate', value: 'lowercase', type: 'string', reference: null },
        { key: 'OrderCutoffDate', value: 'uppercase', type: 'string', reference: null }
      ];
      const result = getFieldValue(fields, 'orderCutoffDate');
      expect(result).toBe('lowercase');
    });
  });

  describe('field does not exist', () => {
    it('should return null when field key does not exist', () => {
      const fields = [
        { key: 'someOtherField', value: 'value', type: 'string', reference: null }
      ];
      const result = getFieldValue(fields, 'orderCutoffDate');
      expect(result).toBeNull();
    });

    it('should return null when array is empty', () => {
      const fields: any[] = [];
      const result = getFieldValue(fields, 'orderCutoffDate');
      expect(result).toBeNull();
    });

    it('should return null when searching for non-existent key in populated array', () => {
      const fields = [
        { key: 'field1', value: 'value1', type: 'string', reference: null },
        { key: 'field2', value: 'value2', type: 'string', reference: null }
      ];
      const result = getFieldValue(fields, 'nonExistentKey');
      expect(result).toBeNull();
    });
  });
});

describe('parseMetaobjectFields', () => {
  describe('valid inputs', () => {
    it('should parse batch with both orderCutoffDate and estimatedShippingDate', () => {
      const fields = [
        { key: 'orderCutoffDate', value: '2025-01-15', type: 'date', reference: null },
        { key: 'estimatedShippingDate', value: '2025-02-01', type: 'date', reference: null }
      ];
      const result = parseMetaobjectFieldList(fields);

      expect(result.orderCutoffDate).toBeInstanceOf(Date);
      expect(result.orderCutoffDate?.toISOString()).toBe('2025-01-15T00:00:00.000Z');
      expect(result.estimatedShippingDate).toBeInstanceOf(Date);
      expect(result.estimatedShippingDate.toISOString()).toBe('2025-02-01T00:00:00.000Z');
    });

    it('should parse open-ended batch with null orderCutoffDate', () => {
      const fields = [
        { key: 'orderCutoffDate', value: null, type: 'date', reference: null },
        { key: 'estimatedShippingDate', value: '2025-02-01', type: 'date', reference: null }
      ];
      const result = parseMetaobjectFieldList(fields);

      expect(result.orderCutoffDate).toBeNull();
      expect(result.estimatedShippingDate).toBeInstanceOf(Date);
      expect(result.estimatedShippingDate.toISOString()).toBe('2025-02-01T00:00:00.000Z');
    });

    it('should parse open-ended batch when orderCutoffDate field is missing', () => {
      const fields = [
        { key: 'estimatedShippingDate', value: '2025-02-01', type: 'date', reference: null }
      ];
      const result = parseMetaobjectFieldList(fields);

      expect(result.orderCutoffDate).toBeNull();
      expect(result.estimatedShippingDate).toBeInstanceOf(Date);
    });

    it('should ignore extra fields not needed for PreOrderBatch', () => {
      const fields = [
        { key: 'extraField1', value: 'ignored', type: 'string', reference: null },
        { key: 'orderCutoffDate', value: '2025-01-15', type: 'date', reference: null },
        { key: 'extraField2', value: 'also-ignored', type: 'string', reference: null },
        { key: 'estimatedShippingDate', value: '2025-02-01', type: 'date', reference: null },
        { key: 'extraField3', value: 'still-ignored', type: 'string', reference: null }
      ];
      const result = parseMetaobjectFieldList(fields);

      expect(result.orderCutoffDate).toBeInstanceOf(Date);
      expect(result.estimatedShippingDate).toBeInstanceOf(Date);
    });
  });

  describe('invalid inputs - missing required fields', () => {
    it('should throw error when estimatedShippingDate is missing', () => {
      const fields = [
        { key: 'orderCutoffDate', value: '2025-01-15', type: 'date', reference: null }
      ];
      expect(() => parseMetaobjectFieldList(fields)).toThrow(
        'Each batch must have an estimatedShippingDate'
      );
    });

    it('should throw error when estimatedShippingDate value is null', () => {
      const fields = [
        { key: 'orderCutoffDate', value: '2025-01-15', type: 'date', reference: null },
        { key: 'estimatedShippingDate', value: null, type: 'date', reference: null }
      ];
      expect(() => parseMetaobjectFieldList(fields)).toThrow(
        'Each batch must have an estimatedShippingDate'
      );
    });

    it('should throw error when fields array is empty', () => {
      const fields: any[] = [];
      expect(() => parseMetaobjectFieldList(fields)).toThrow(
        'Each batch must have an estimatedShippingDate'
      );
    });
  });

  describe('invalid inputs - invalid date formats', () => {
    it('should throw error when orderCutoffDate is invalid', () => {
      const fields = [
        { key: 'orderCutoffDate', value: 'invalid-date', type: 'date', reference: null },
        { key: 'estimatedShippingDate', value: '2025-02-01', type: 'date', reference: null }
      ];
      expect(() => parseMetaobjectFieldList(fields)).toThrow(
        'Invalid orderCutoffDate: invalid-date'
      );
    });

    it('should throw error when estimatedShippingDate is invalid', () => {
      const fields = [
        { key: 'orderCutoffDate', value: '2025-01-15', type: 'date', reference: null },
        { key: 'estimatedShippingDate', value: 'invalid-date', type: 'date', reference: null }
      ];
      expect(() => parseMetaobjectFieldList(fields)).toThrow(
        'Invalid estimatedShippingDate: invalid-date'
      );
    });
  });
});

describe('deduplicateOpenEndedBatches', () => {
  describe('no deduplication needed', () => {
    it('should return new array when no open-ended batches exist', () => {
      const batches = [
        { orderCutoffDate: new Date('2025-01-15'), estimatedShippingDate: new Date('2025-02-01') },
        { orderCutoffDate: new Date('2025-02-15'), estimatedShippingDate: new Date('2025-03-01') }
      ];
      const result = deduplicateOpenEndedBatches(batches);

      expect(result).toEqual(batches);
      expect(result).not.toBe(batches); // Should be a new array (immutability)
      expect(result.length).toBe(2);
    });

    it('should return new array when exactly one open-ended batch exists', () => {
      const batches = [
        { orderCutoffDate: new Date('2025-01-15'), estimatedShippingDate: new Date('2025-02-01') },
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-03-01') }
      ];
      const result = deduplicateOpenEndedBatches(batches);

      expect(result).toEqual(batches);
      expect(result).not.toBe(batches); // Should be a new array (immutability)
      expect(result.length).toBe(2);
    });

    it('should return new empty array when input is empty', () => {
      const batches: PreOrderBatch[] = [];
      const result = deduplicateOpenEndedBatches(batches);

      expect(result).toEqual([]);
      expect(result).not.toBe(batches); // Should be a new array (immutability)
    });

    it('should not modify original array', () => {
      const batches = [
        { orderCutoffDate: new Date('2025-01-15'), estimatedShippingDate: new Date('2025-02-01') }
      ];
      const original = [...batches];
      deduplicateOpenEndedBatches(batches);

      expect(batches).toEqual(original);
    });
  });

  describe('deduplication needed', () => {
    it('should keep only the open-ended batch with latest shipping date', () => {
      const batches = [
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-01-15') },
        { orderCutoffDate: new Date('2025-01-01'), estimatedShippingDate: new Date('2025-02-01') },
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-03-01') }, // Latest
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-02-15') }
      ];
      const result = deduplicateOpenEndedBatches(batches);

      expect(result.length).toBe(2); // 1 closed + 1 open-ended
      expect(result[0].orderCutoffDate).toEqual(new Date('2025-01-01'));
      expect(result[1].orderCutoffDate).toBeNull();
      expect(result[1].estimatedShippingDate).toEqual(new Date('2025-03-01'));
    });

    it('should handle all batches being open-ended', () => {
      const batches = [
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-01-15') },
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-03-01') }, // Latest
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-02-15') }
      ];
      const result = deduplicateOpenEndedBatches(batches);

      expect(result.length).toBe(1);
      expect(result[0].orderCutoffDate).toBeNull();
      expect(result[0].estimatedShippingDate).toEqual(new Date('2025-03-01'));
    });

    it('should keep first when multiple open-ended batches have same shipping date', () => {
      const batch1 = { orderCutoffDate: null, estimatedShippingDate: new Date('2025-03-01') };
      const batch2 = { orderCutoffDate: null, estimatedShippingDate: new Date('2025-03-01') };
      const batch3 = { orderCutoffDate: null, estimatedShippingDate: new Date('2025-03-01') };
      const batches = [batch1, batch2, batch3];

      const result = deduplicateOpenEndedBatches(batches);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(batch1); // Should keep first one (tie-breaking)
    });

    it('should preserve closed batches when deduplicating', () => {
      const closed1 = { orderCutoffDate: new Date('2025-01-01'), estimatedShippingDate: new Date('2025-02-01') };
      const closed2 = { orderCutoffDate: new Date('2025-02-01'), estimatedShippingDate: new Date('2025-03-01') };
      const openEarly = { orderCutoffDate: null, estimatedShippingDate: new Date('2025-04-01') };
      const openLate = { orderCutoffDate: null, estimatedShippingDate: new Date('2025-05-01') }; // Latest

      const batches = [closed1, openEarly, closed2, openLate];
      const result = deduplicateOpenEndedBatches(batches);

      expect(result.length).toBe(3);
      expect(result).toContain(closed1);
      expect(result).toContain(closed2);
      expect(result).toContain(openLate);
      expect(result).not.toContain(openEarly);
    });

    it('should return new array after deduplication', () => {
      const batches = [
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-01-15') },
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-03-01') }
      ];
      const result = deduplicateOpenEndedBatches(batches);

      expect(result).not.toBe(batches); // Should be a new array
    });
  });

  describe('edge cases', () => {
    it('should handle two open-ended batches', () => {
      const batches = [
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-01-15') },
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-03-01') } // Latest
      ];
      const result = deduplicateOpenEndedBatches(batches);

      expect(result.length).toBe(1);
      expect(result[0].estimatedShippingDate).toEqual(new Date('2025-03-01'));
    });

    it('should handle single open-ended batch', () => {
      const batches = [
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-03-01') }
      ];
      const result = deduplicateOpenEndedBatches(batches);

      expect(result.length).toBe(1);
      expect(result[0]).toEqual(batches[0]);
      expect(result).not.toBe(batches);
    });
  });
});

describe('sortBatchesByOrderCutoffDate', () => {
  describe('sorting closed batches', () => {
    it('should sort batches chronologically when all have cutoff dates', () => {
      const batches = [
        { orderCutoffDate: new Date('2025-03-01'), estimatedShippingDate: new Date('2025-04-01') },
        { orderCutoffDate: new Date('2025-01-15'), estimatedShippingDate: new Date('2025-02-01') },
        { orderCutoffDate: new Date('2025-02-15'), estimatedShippingDate: new Date('2025-03-15') }
      ];
      const result = sortBatchesByOrderCutoffDate(batches);

      expect(result.length).toBe(3);
      expect(result[0].orderCutoffDate).toEqual(new Date('2025-01-15')); // Oldest first
      expect(result[1].orderCutoffDate).toEqual(new Date('2025-02-15'));
      expect(result[2].orderCutoffDate).toEqual(new Date('2025-03-01')); // Newest last
    });

    it('should maintain stable sort for batches with same cutoff date', () => {
      const batch1 = { orderCutoffDate: new Date('2025-01-15'), estimatedShippingDate: new Date('2025-02-01') };
      const batch2 = { orderCutoffDate: new Date('2025-01-15'), estimatedShippingDate: new Date('2025-03-01') };
      const batch3 = { orderCutoffDate: new Date('2025-01-15'), estimatedShippingDate: new Date('2025-04-01') };
      const batches = [batch1, batch2, batch3];

      const result = sortBatchesByOrderCutoffDate(batches);

      expect(result.length).toBe(3);
      expect(result[0]).toBe(batch1); // Same order preserved
      expect(result[1]).toBe(batch2);
      expect(result[2]).toBe(batch3);
    });

    it('should sort already sorted array correctly', () => {
      const batches = [
        { orderCutoffDate: new Date('2025-01-15'), estimatedShippingDate: new Date('2025-02-01') },
        { orderCutoffDate: new Date('2025-02-15'), estimatedShippingDate: new Date('2025-03-01') },
        { orderCutoffDate: new Date('2025-03-15'), estimatedShippingDate: new Date('2025-04-01') }
      ];
      const result = sortBatchesByOrderCutoffDate(batches);

      expect(result[0].orderCutoffDate).toEqual(new Date('2025-01-15'));
      expect(result[1].orderCutoffDate).toEqual(new Date('2025-02-15'));
      expect(result[2].orderCutoffDate).toEqual(new Date('2025-03-15'));
    });
  });

  describe('sorting with null cutoff dates', () => {
    it('should place null cutoff dates last', () => {
      const batches = [
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-04-01') },
        { orderCutoffDate: new Date('2025-02-01'), estimatedShippingDate: new Date('2025-03-01') },
        { orderCutoffDate: new Date('2025-01-15'), estimatedShippingDate: new Date('2025-02-15') }
      ];
      const result = sortBatchesByOrderCutoffDate(batches);

      expect(result.length).toBe(3);
      expect(result[0].orderCutoffDate).toEqual(new Date('2025-01-15')); // Oldest closed
      expect(result[1].orderCutoffDate).toEqual(new Date('2025-02-01')); // Newer closed
      expect(result[2].orderCutoffDate).toBeNull(); // Open-ended last
    });

    it('should sort closed batches and place all nulls at the end', () => {
      const batch1 = { orderCutoffDate: null, estimatedShippingDate: new Date('2025-05-01') };
      const batch2 = { orderCutoffDate: new Date('2025-03-01'), estimatedShippingDate: new Date('2025-04-01') };
      const batch3 = { orderCutoffDate: null, estimatedShippingDate: new Date('2025-06-01') };
      const batch4 = { orderCutoffDate: new Date('2025-01-15'), estimatedShippingDate: new Date('2025-02-15') };
      const batches = [batch1, batch2, batch3, batch4];

      const result = sortBatchesByOrderCutoffDate(batches);

      expect(result.length).toBe(4);
      expect(result[0].orderCutoffDate).toEqual(new Date('2025-01-15'));
      expect(result[1].orderCutoffDate).toEqual(new Date('2025-03-01'));
      expect(result[2].orderCutoffDate).toBeNull();
      expect(result[3].orderCutoffDate).toBeNull();
    });

    it('should preserve order of null batches (stable sort)', () => {
      const batch1 = { orderCutoffDate: null, estimatedShippingDate: new Date('2025-05-01') };
      const batch2 = { orderCutoffDate: null, estimatedShippingDate: new Date('2025-03-01') };
      const batch3 = { orderCutoffDate: null, estimatedShippingDate: new Date('2025-06-01') };
      const batches = [batch1, batch2, batch3];

      const result = sortBatchesByOrderCutoffDate(batches);

      expect(result.length).toBe(3);
      expect(result[0]).toBe(batch1); // Order preserved
      expect(result[1]).toBe(batch2);
      expect(result[2]).toBe(batch3);
    });

    it('should handle all null cutoff dates', () => {
      const batches = [
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-03-01') },
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-01-15') },
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-02-01') }
      ];
      const result = sortBatchesByOrderCutoffDate(batches);

      expect(result.length).toBe(3);
      // All null, so order should be preserved (stable sort)
      expect(result[0].estimatedShippingDate).toEqual(new Date('2025-03-01'));
      expect(result[1].estimatedShippingDate).toEqual(new Date('2025-01-15'));
      expect(result[2].estimatedShippingDate).toEqual(new Date('2025-02-01'));
    });
  });

  describe('edge cases', () => {
    it('should handle single batch with cutoff date', () => {
      const batches = [
        { orderCutoffDate: new Date('2025-01-15'), estimatedShippingDate: new Date('2025-02-01') }
      ];
      const result = sortBatchesByOrderCutoffDate(batches);

      expect(result.length).toBe(1);
      expect(result[0]).toEqual(batches[0]);
    });

    it('should handle single batch with null cutoff date', () => {
      const batches = [
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-02-01') }
      ];
      const result = sortBatchesByOrderCutoffDate(batches);

      expect(result.length).toBe(1);
      expect(result[0]).toEqual(batches[0]);
    });

    it('should handle empty array', () => {
      const batches: PreOrderBatch[] = [];
      const result = sortBatchesByOrderCutoffDate(batches);

      expect(result).toEqual([]);
    });

    it('should return new array (immutability)', () => {
      const batches = [
        { orderCutoffDate: new Date('2025-01-15'), estimatedShippingDate: new Date('2025-02-01') },
        { orderCutoffDate: new Date('2025-02-15'), estimatedShippingDate: new Date('2025-03-01') }
      ];
      const result = sortBatchesByOrderCutoffDate(batches);

      expect(result).not.toBe(batches);
    });

    it('should not modify original array', () => {
      const batches = [
        { orderCutoffDate: new Date('2025-03-01'), estimatedShippingDate: new Date('2025-04-01') },
        { orderCutoffDate: new Date('2025-01-15'), estimatedShippingDate: new Date('2025-02-01') }
      ];
      const original = [...batches];
      sortBatchesByOrderCutoffDate(batches);

      expect(batches).toEqual(original);
    });
  });

  describe('complex scenarios', () => {
    it('should handle mixed dates spanning years', () => {
      const batches = [
        { orderCutoffDate: new Date('2026-01-15'), estimatedShippingDate: new Date('2026-02-01') },
        { orderCutoffDate: new Date('2025-12-15'), estimatedShippingDate: new Date('2026-01-01') },
        { orderCutoffDate: null, estimatedShippingDate: new Date('2026-03-01') }
      ];
      const result = sortBatchesByOrderCutoffDate(batches);

      expect(result[0].orderCutoffDate).toEqual(new Date('2025-12-15')); // Oldest
      expect(result[1].orderCutoffDate).toEqual(new Date('2026-01-15'));
      expect(result[2].orderCutoffDate).toBeNull(); // Null last
    });

    it('should handle realistic timeline scenario', () => {
      const batches = [
        { orderCutoffDate: null, estimatedShippingDate: new Date('2025-06-01') }, // Final batch
        { orderCutoffDate: new Date('2025-02-15'), estimatedShippingDate: new Date('2025-03-15') }, // Batch 2
        { orderCutoffDate: new Date('2025-01-15'), estimatedShippingDate: new Date('2025-02-15') }  // Batch 1
      ];
      const result = sortBatchesByOrderCutoffDate(batches);

      expect(result.length).toBe(3);
      expect(result[0].orderCutoffDate).toEqual(new Date('2025-01-15'));
      expect(result[1].orderCutoffDate).toEqual(new Date('2025-02-15'));
      expect(result[2].orderCutoffDate).toBeNull();
    });
  });
});

describe('PreOrderTimeline.fromMetaobjectList', () => {
  describe('null and undefined inputs', () => {
    it('should return empty timeline when input is null', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(null);

      expect(timeline.isEmpty()).toBe(true);
      expect(timeline.getBatches()).toEqual([]);
    });

    it('should return empty timeline when input is undefined', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(undefined);

      expect(timeline.isEmpty()).toBe(true);
      expect(timeline.getBatches()).toEqual([]);
    });

    it('should preserve orderDate when input is null', () => {
      const customDate = new Date('2025-01-15');
      const timeline = PreOrderTimeline.fromMetaobjectList(null, customDate);

      expect(timeline.getOrderDate()).toEqual(customDate);
    });

    it('should return empty timeline when references is missing', () => {
      const metaobjectList = {
        id: 'gid://shopify/Metafield/123',
        namespace: 'custom',
        key: 'pre_order_timeline',
        type: 'list.metaobject_reference',
        value: 'gid://shopify/Metaobject/123',
        reference: null
      } as Metafield;

      const timeline = PreOrderTimeline.fromMetaobjectList(metaobjectList);

      expect(timeline.isEmpty()).toBe(true);
    });
  });

  describe('empty data', () => {
    it('should return empty timeline when edges array is empty', () => {
      const metaobjectList = createMetaobjectList([]);

      const timeline = PreOrderTimeline.fromMetaobjectList(metaobjectList);

      expect(timeline.isEmpty()).toBe(true);
      expect(timeline.getBatches()).toEqual([]);
    });

    it('should preserve orderDate when edges array is empty', () => {
      const customDate = new Date('2025-01-15');
      const metaobjectList = createMetaobjectList([]);

      const timeline = PreOrderTimeline.fromMetaobjectList(metaobjectList, customDate);

      expect(timeline.getOrderDate()).toEqual(customDate);
    });
  });

  describe('single batch', () => {
    it('should parse single valid batch', () => {
      const metaobjectList = createMetaobjectList([
        { cutoff: '2025-01-15', shipping: '2025-02-01' }
      ]);

      const timeline = PreOrderTimeline.fromMetaobjectList(metaobjectList);

      expect(timeline.isEmpty()).toBe(false);
      expect(timeline.getBatches().length).toBe(1);
      expect(timeline.getBatches()[0].orderCutoffDate).toEqual(new Date('2025-01-15'));
      expect(timeline.getBatches()[0].estimatedShippingDate).toEqual(new Date('2025-02-01'));
    });

    it('should parse single open-ended batch', () => {
      const metaobjectList = createMetaobjectList([
        { cutoff: null, shipping: '2025-02-01' }
      ]);

      const timeline = PreOrderTimeline.fromMetaobjectList(metaobjectList);

      expect(timeline.getBatches().length).toBe(1);
      expect(timeline.getBatches()[0].orderCutoffDate).toBeNull();
    });

    it('should preserve custom orderDate for single batch', () => {
      const customDate = new Date('2025-01-15');
      const metaobjectList = createMetaobjectList([
        { cutoff: null, shipping: '2025-02-01' }
      ]);

      const timeline = PreOrderTimeline.fromMetaobjectList(metaobjectList, customDate);

      expect(timeline.getOrderDate()).toEqual(customDate);
    });
  });

  describe('multiple batches - full pipeline', () => {
    it('should parse, deduplicate, and sort multiple batches', () => {
      const metaobjectList = createMetaobjectList([
        { cutoff: '2025-03-01', shipping: '2025-04-01' },
        { cutoff: '2025-01-15', shipping: '2025-02-15' },
        { cutoff: null, shipping: '2025-05-01' }
      ]);

      const timeline = PreOrderTimeline.fromMetaobjectList(metaobjectList);
      const batches = timeline.getBatches();

      expect(batches.length).toBe(3);
      // Should be sorted: oldest closed first, then newer closed, then open-ended
      expect(batches[0].orderCutoffDate).toEqual(new Date('2025-01-15'));
      expect(batches[1].orderCutoffDate).toEqual(new Date('2025-03-01'));
      expect(batches[2].orderCutoffDate).toBeNull();
    });

    it('should deduplicate multiple open-ended batches', () => {
      const metaobjectList = createMetaobjectList([
        { cutoff: null, shipping: '2025-03-01' },
        { cutoff: '2025-01-15', shipping: '2025-02-15' },
        { cutoff: null, shipping: '2025-05-01' } // Latest open-ended
      ]);

      const timeline = PreOrderTimeline.fromMetaobjectList(metaobjectList);
      const batches = timeline.getBatches();

      expect(batches.length).toBe(2); // Should have deduplicated to 1 closed + 1 open-ended
      expect(batches[0].orderCutoffDate).toEqual(new Date('2025-01-15'));
      expect(batches[1].orderCutoffDate).toBeNull();
      expect(batches[1].estimatedShippingDate).toEqual(new Date('2025-05-01')); // Latest kept
    });

    it('should preserve custom orderDate for multiple batches', () => {
      const customDate = new Date('2025-01-15');
      const metaobjectList = createMetaobjectList([
        { cutoff: '2025-02-01', shipping: '2025-03-01' },
        { cutoff: null, shipping: '2025-04-01' }
      ]);

      const timeline = PreOrderTimeline.fromMetaobjectList(metaobjectList, customDate);

      expect(timeline.getOrderDate()).toEqual(customDate);
    });
  });

  describe('error handling - resilient filtering', () => {
    it('should filter out batch missing estimatedShippingDate', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const metaobjectList: Metafield = {
        id: 'gid://shopify/Metafield/123',
        namespace: 'custom',
        key: 'pre_order_timeline',
        type: 'list.metaobject_reference',
        value: 'gid://shopify/Metaobject/123',
        reference: null,
        references: [
          {
            id: 'gid://shopify/Metaobject/1',
            fields: [
              { key: 'orderCutoffDate', value: '2025-01-15', type: 'date', reference: null }
              // Missing estimatedShippingDate
            ]
          }
        ]
      };

      const timeline = PreOrderTimeline.fromMetaobjectList(metaobjectList);

      expect(timeline.isEmpty()).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error parsing batch at index 0:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should filter out batch with invalid date format', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const metaobjectList: Metafield = {
        id: 'gid://shopify/Metafield/123',
        namespace: 'custom',
        key: 'pre_order_timeline',
        type: 'list.metaobject_reference',
        value: 'gid://shopify/Metaobject/123',
        reference: null,
        references: [
          {
            id: 'gid://shopify/Metaobject/1',
            fields: [
              { key: 'estimatedShippingDate', value: 'invalid-date', type: 'date', reference: null }
            ]
          }
        ]
      };

      const timeline = PreOrderTimeline.fromMetaobjectList(metaobjectList);

      expect(timeline.isEmpty()).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should keep valid batches and filter out invalid ones', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const metaobjectList: Metafield = {
        id: 'gid://shopify/Metafield/123',
        namespace: 'custom',
        key: 'pre_order_timeline',
        type: 'list.metaobject_reference',
        value: 'gid://shopify/Metaobject/123',
        reference: null,
        references: [
          {
            id: 'gid://shopify/Metaobject/1',
            fields: [
              { key: 'orderCutoffDate', value: '2025-01-15', type: 'date', reference: null },
              { key: 'estimatedShippingDate', value: '2025-02-01', type: 'date', reference: null }
            ]
          },
          {
            id: 'gid://shopify/Metaobject/2',
            fields: [
              { key: 'estimatedShippingDate', value: 'not-a-valid-date', type: 'date', reference: null }
            ]
          },
          {
            id: 'gid://shopify/Metaobject/3',
            fields: [
              { key: 'orderCutoffDate', value: '2025-02-15', type: 'date', reference: null },
              { key: 'estimatedShippingDate', value: '2025-03-01', type: 'date', reference: null }
            ]
          }
        ]
      };

      const timeline = PreOrderTimeline.fromMetaobjectList(metaobjectList);
      const batches = timeline.getBatches();

      expect(batches.length).toBe(2); // Only the 2 valid batches
      expect(batches[0].orderCutoffDate).toEqual(new Date('2025-01-15'));
      expect(batches[0].estimatedShippingDate).toEqual(new Date('2025-02-01'));
      expect(batches[1].orderCutoffDate).toEqual(new Date('2025-02-15'));
      expect(batches[1].estimatedShippingDate).toEqual(new Date('2025-03-01'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error parsing batch at index 1:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should filter out batch when fields is not an array', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const metaobjectList: Metafield = {
        id: 'gid://shopify/Metafield/123',
        namespace: 'custom',
        key: 'pre_order_timeline',
        type: 'list.metaobject_reference',
        value: 'gid://shopify/Metaobject/123',
        reference: null,
        references: [
          {
            id: 'gid://shopify/Metaobject/1',
            fields: null as any
          }
        ]
      };

      const timeline = PreOrderTimeline.fromMetaobjectList(metaobjectList);

      expect(timeline.isEmpty()).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should include batch index in error message', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const metaobjectList: Metafield = {
        id: 'gid://shopify/Metafield/123',
        namespace: 'custom',
        key: 'pre_order_timeline',
        type: 'list.metaobject_reference',
        value: 'gid://shopify/Metaobject/123',
        reference: null,
        references: [
          {
            id: 'gid://shopify/Metaobject/1',
            fields: [
              { key: 'estimatedShippingDate', value: '2025-02-01', type: 'date', reference: null }
            ]
          },
          {
            id: 'gid://shopify/Metaobject/2',
            fields: [
              { key: 'estimatedShippingDate', value: '2025-03-01', type: 'date', reference: null }
            ]
          },
          {
            id: 'gid://shopify/Metaobject/3',
            fields: [
              { key: 'orderCutoffDate', value: 'bad-date', type: 'date', reference: null },
              { key: 'estimatedShippingDate', value: '2025-04-01', type: 'date', reference: null }
            ]
          }
        ]
      };

      PreOrderTimeline.fromMetaobjectList(metaobjectList);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error parsing batch at index 2:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle all invalid batches gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const metaobjectList: Metafield = {
        id: 'gid://shopify/Metafield/123',
        namespace: 'custom',
        key: 'pre_order_timeline',
        type: 'list.metaobject_reference',
        value: 'gid://shopify/Metaobject/123',
        reference: null,
        references: [
          {
            id: 'gid://shopify/Metaobject/1',
            fields: [
              { key: 'estimatedShippingDate', value: 'totally-invalid', type: 'date', reference: null }
            ]
          },
          {
            id: 'gid://shopify/Metaobject/2',
            fields: [
              { key: 'estimatedShippingDate', value: 'also-invalid', type: 'date', reference: null }
            ]
          }
        ]
      };

      const timeline = PreOrderTimeline.fromMetaobjectList(metaobjectList);

      expect(timeline.isEmpty()).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);

      consoleErrorSpy.mockRestore();
    });
  });
});

describe('PreOrderTimeline.getByDateAndLocation', () => {

  describe('location-based timeline selection', () => {
    it('should use US timeline when customer ships to US and US timeline exists', () => {
      const usTimeline = createMetaobjectList([{ cutoff: '2025-01-15', shipping: '2025-02-01' }]);
      const wwTimeline = createMetaobjectList([{ cutoff: '2025-01-20', shipping: '2025-02-10' }]);

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-01'),
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: wwTimeline,
          inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/2', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          inStockToPreOrderUSTransitionDate: { id: 'gid://shopify/Metafield/1', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      const batches = timeline.getBatches();
      expect(batches.length).toBe(1);
      expect(batches[0].orderCutoffDate).toEqual(new Date('2025-01-15')); // US timeline
    });

    it('should use WW timeline when customer does not ship to US', () => {
      const usTimeline = createMetaobjectList([{ cutoff: '2025-01-15', shipping: '2025-02-01' }]);
      const wwTimeline = createMetaobjectList([{ cutoff: '2025-01-20', shipping: '2025-02-10' }]);

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'CA',
        new Date('2025-01-01'),
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: wwTimeline,
          inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/2', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          inStockToPreOrderUSTransitionDate: { id: 'gid://shopify/Metafield/1', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      const batches = timeline.getBatches();
      expect(batches.length).toBe(1);
      expect(batches[0].orderCutoffDate).toEqual(new Date('2025-01-20')); // WW timeline
    });

    it('should fall back to WW timeline when US customer but US timeline missing', () => {
      const wwTimeline = createMetaobjectList([{ cutoff: '2025-01-20', shipping: '2025-02-10' }]);

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-01'),
        {
          preOrderUSTimeline: null,
          preOrderWWTimeline: wwTimeline,
          inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/2', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          inStockToPreOrderUSTransitionDate: null,
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      const batches = timeline.getBatches();
      expect(batches.length).toBe(1);
      expect(batches[0].orderCutoffDate).toEqual(new Date('2025-01-20')); // WW timeline
    });

    it('should use WW timeline for various non-US countries', () => {
      const wwTimeline = createMetaobjectList([{ cutoff: null, shipping: '2025-02-10' }]);

      ['CA', 'GB', 'DE', 'JP', 'AU'].forEach(country => {
        const timeline = PreOrderTimeline.getByDateAndLocation(
          country,
          new Date('2025-01-01'),
          {
            preOrderWWTimeline: wwTimeline,
            preOrderUSTimeline: null,
            inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/2', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
            inStockToPreOrderUSTransitionDate: null,
            isFulfillingFromUS: null,
            processingTimeString: null
          }
        );

        expect(timeline.getBatches().length).toBe(1);
      });
    });
  });

  describe('US customer fallback scenarios', () => {
    it('should fallback to WW timeline when US timeline has no transition date', () => {
      const usTimeline = createMetaobjectList([{ cutoff: '2025-01-15', shipping: '2025-02-01' }]);
      const wwTimeline = createMetaobjectList([{ cutoff: '2025-01-20', shipping: '2025-02-10' }]);

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-01'),
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: wwTimeline,
          inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/2', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          inStockToPreOrderUSTransitionDate: null, // No US transition date
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      const batches = timeline.getBatches();
      expect(batches.length).toBe(1);
      expect(batches[0].orderCutoffDate).toEqual(new Date('2025-01-20')); // WW timeline used
    });

    it('should fallback to WW timeline when order date is before US transition date', () => {
      const usTimeline = createMetaobjectList([{ cutoff: '2025-01-15', shipping: '2025-02-01' }]);
      const wwTimeline = createMetaobjectList([{ cutoff: '2025-01-20', shipping: '2025-02-10' }]);

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-01'), // Order date before US transition
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: wwTimeline,
          inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/2', namespace: 'custom', key: 'transition', value: '2024-12-15', type: 'date', reference: null },
          inStockToPreOrderUSTransitionDate: { id: 'gid://shopify/Metafield/1', namespace: 'custom', key: 'transition', value: '2025-01-10', type: 'date', reference: null },
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      const batches = timeline.getBatches();
      expect(batches.length).toBe(1);
      expect(batches[0].orderCutoffDate).toEqual(new Date('2025-01-20')); // WW timeline used
    });

    it('should fallback to WW timeline when order date is after all US cutoff dates', () => {
      const usTimeline = createMetaobjectList([
        { cutoff: '2025-01-15', shipping: '2025-02-01' },
        { cutoff: '2025-02-15', shipping: '2025-03-01' }
      ]);
      const wwTimeline = createMetaobjectList([{ cutoff: null, shipping: '2025-04-01' }]);

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-03-01'), // Order date after all US cutoffs
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: wwTimeline,
          inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/2', namespace: 'custom', key: 'transition', value: '2024-12-15', type: 'date', reference: null },
          inStockToPreOrderUSTransitionDate: { id: 'gid://shopify/Metafield/1', namespace: 'custom', key: 'transition', value: '2024-12-15', type: 'date', reference: null },
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      const batches = timeline.getBatches();
      expect(batches.length).toBe(1);
      expect(batches[0].orderCutoffDate).toBeNull(); // WW timeline open-ended batch
      expect(batches[0].estimatedShippingDate).toEqual(new Date('2025-04-01'));
    });

    it('should return empty timeline when both US and WW timelines fail validation', () => {
      const usTimeline = createMetaobjectList([{ cutoff: '2025-01-15', shipping: '2025-02-01' }]);
      const wwTimeline = createMetaobjectList([{ cutoff: '2025-01-20', shipping: '2025-02-10' }]);

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-01'),
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: wwTimeline,
          inStockToPreOrderWWTransitionDate: null, // No WW transition
          inStockToPreOrderUSTransitionDate: null,  // No US transition
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      expect(timeline.isEmpty()).toBe(true);
    });

    it('should use US timeline when both US and WW are valid', () => {
      const usTimeline = createMetaobjectList([{ cutoff: '2025-01-15', shipping: '2025-02-01' }]);
      const wwTimeline = createMetaobjectList([{ cutoff: '2025-01-20', shipping: '2025-02-10' }]);

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-01'),
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: wwTimeline,
          inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/2', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          inStockToPreOrderUSTransitionDate: { id: 'gid://shopify/Metafield/1', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      const batches = timeline.getBatches();
      expect(batches.length).toBe(1);
      expect(batches[0].orderCutoffDate).toEqual(new Date('2025-01-15')); // US timeline preferred
    });

    it('should fallback when US timeline exists but WW has better match', () => {
      const usTimeline = createMetaobjectList([
        { cutoff: '2025-01-05', shipping: '2025-02-01' }
      ]);
      const wwTimeline = createMetaobjectList([
        { cutoff: '2025-01-20', shipping: '2025-02-10' },
        { cutoff: null, shipping: '2025-03-01' }
      ]);

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-10'), // After US cutoff, but before WW cutoff
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: wwTimeline,
          inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/2', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          inStockToPreOrderUSTransitionDate: { id: 'gid://shopify/Metafield/1', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      const batches = timeline.getBatches();
      expect(batches.length).toBe(2);
      expect(batches[0].orderCutoffDate).toEqual(new Date('2025-01-20')); // WW timeline
    });
  });

  describe('International customer scenarios', () => {
    it('should not fallback to US timeline for international customers', () => {
      const usTimeline = createMetaobjectList([{ cutoff: '2025-01-15', shipping: '2025-02-01' }]);
      const wwTimeline = createMetaobjectList([{ cutoff: '2025-01-20', shipping: '2025-02-10' }]);

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'CA',
        new Date('2025-02-25'), // After all cutoffs
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: wwTimeline,
          inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/2', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          inStockToPreOrderUSTransitionDate: { id: 'gid://shopify/Metafield/1', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      // Should return empty since order is after all WW cutoffs, even though US timeline exists
      expect(timeline.isEmpty()).toBe(true);
    });

    it('should return empty timeline when WW timeline has no transition date', () => {
      const wwTimeline = createMetaobjectList([{ cutoff: '2025-01-20', shipping: '2025-02-10' }]);

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'GB',
        new Date('2025-01-01'),
        {
          preOrderWWTimeline: wwTimeline,
          preOrderUSTimeline: null,
          inStockToPreOrderWWTransitionDate: null, // No transition date
          inStockToPreOrderUSTransitionDate: null,
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      expect(timeline.isEmpty()).toBe(true);
    });
  });

  describe('no timeline available', () => {
    it('should return empty timeline when no timelines exist', () => {
      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-01'),
        {
          preOrderUSTimeline: null,
          preOrderWWTimeline: null,
          inStockToPreOrderWWTransitionDate: null,
          inStockToPreOrderUSTransitionDate: null,
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      expect(timeline.isEmpty()).toBe(true);
    });

    it('should return empty timeline when WW timeline is null and US timeline missing', () => {
      const timeline = PreOrderTimeline.getByDateAndLocation(
        'CA',
        new Date('2025-01-01'),
        {
          preOrderWWTimeline: null,
          preOrderUSTimeline: null,
          inStockToPreOrderWWTransitionDate: null,
          inStockToPreOrderUSTransitionDate: null,
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      expect(timeline.isEmpty()).toBe(true);
    });
  });

  describe('isFulfillingFromUS logic', () => {
    it('should return empty timeline when US customer has no US timeline but has US inventory', () => {
      const wwTimeline = createMetaobjectList([{ cutoff: '2025-01-20', shipping: '2025-02-10' }]);
      const isFulfillingFromUS = {
        id: 'gid://shopify/Metafield/3',
        namespace: 'productListing',
        key: 'isFulfillingFromUS',
        value: 'true',
        type: 'boolean',
        reference: null
      };

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-01'),
        {
          preOrderUSTimeline: null,
          preOrderWWTimeline: wwTimeline,
          inStockToPreOrderUSTransitionDate: { id: 'gid://shopify/Metafield/1', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/2', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          isFulfillingFromUS,
          processingTimeString: null
        }
      );

      expect(timeline.isEmpty()).toBe(true);
      expect(timeline.getEstimatedShippingDate()).toBeNull();
    });

    it('should fallback to WW timeline when US customer has no US timeline and no US inventory', () => {
      const wwTimeline = createMetaobjectList([{ cutoff: '2025-01-20', shipping: '2025-02-10' }]);
      const isFulfillingFromUS = {
        id: 'gid://shopify/Metafield/3',
        namespace: 'productListing',
        key: 'isFulfillingFromUS',
        value: 'false',
        type: 'boolean',
        reference: null
      };

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-01'),
        {
          preOrderUSTimeline: null,
          preOrderWWTimeline: wwTimeline,
          inStockToPreOrderUSTransitionDate: null,
          inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/2', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          isFulfillingFromUS,
          processingTimeString: null
        }
      );

      expect(timeline.isEmpty()).toBe(false);
      const batches = timeline.getBatches();
      expect(batches.length).toBe(1);
      expect(batches[0].orderCutoffDate).toEqual(new Date('2025-01-20'));
    });

    it('should fallback to WW timeline when US customer has no US timeline and isFulfillingFromUS is null', () => {
      const wwTimeline = createMetaobjectList([{ cutoff: '2025-01-20', shipping: '2025-02-10' }]);

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-01'),
        {
          preOrderUSTimeline: null,
          preOrderWWTimeline: wwTimeline,
          inStockToPreOrderUSTransitionDate: null,
          inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/2', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      expect(timeline.isEmpty()).toBe(false);
      const batches = timeline.getBatches();
      expect(batches.length).toBe(1);
      expect(batches[0].orderCutoffDate).toEqual(new Date('2025-01-20'));
    });

    it('should not affect non-US customers with isFulfillingFromUS flag', () => {
      const wwTimeline = createMetaobjectList([{ cutoff: '2025-01-20', shipping: '2025-02-10' }]);
      const isFulfillingFromUS = {
        id: 'gid://shopify/Metafield/3',
        namespace: 'productListing',
        key: 'isFulfillingFromUS',
        value: 'true',
        type: 'boolean',
        reference: null
      };

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'CA',
        new Date('2025-01-01'),
        {
          preOrderUSTimeline: null,
          preOrderWWTimeline: wwTimeline,
          inStockToPreOrderUSTransitionDate: null,
          inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/2', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          isFulfillingFromUS,
          processingTimeString: null
        }
      );

      expect(timeline.isEmpty()).toBe(false);
      const batches = timeline.getBatches();
      expect(batches.length).toBe(1);
      expect(batches[0].orderCutoffDate).toEqual(new Date('2025-01-20'));
    });

    it('should use US timeline when available even if isFulfillingFromUS is true', () => {
      const usTimeline = createMetaobjectList([{ cutoff: '2025-01-15', shipping: '2025-02-01' }]);
      const wwTimeline = createMetaobjectList([{ cutoff: '2025-01-20', shipping: '2025-02-10' }]);
      const isFulfillingFromUS = {
        id: 'gid://shopify/Metafield/3',
        namespace: 'productListing',
        key: 'isFulfillingFromUS',
        value: 'true',
        type: 'boolean',
        reference: null
      };

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-01'),
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: wwTimeline,
          inStockToPreOrderUSTransitionDate: { id: 'gid://shopify/Metafield/1', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/2', namespace: 'custom', key: 'transition', value: '2024-12-01', type: 'date', reference: null },
          isFulfillingFromUS,
          processingTimeString: null
        }
      );

      expect(timeline.isEmpty()).toBe(false);
      const batches = timeline.getBatches();
      expect(batches.length).toBe(1);
      expect(batches[0].orderCutoffDate).toEqual(new Date('2025-01-15')); // US timeline takes precedence
    });
  });

  describe('transition date logic', () => {
    it('should return empty timeline when order placed before US transition date', () => {
      const usTimeline = createMetaobjectList([{ cutoff: null, shipping: '2025-02-01' }]);
      const transitionDate = { id: 'gid://shopify/Metafield/1', namespace: 'custom', key: 'inStockToPreOrderUSTransitionDate', value: '2025-01-15', type: 'date', reference: null };

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-10'), // Before transition
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: null,
          inStockToPreOrderUSTransitionDate: transitionDate,
          inStockToPreOrderWWTransitionDate: null,
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      expect(timeline.isEmpty()).toBe(true);
    });

    it('should return timeline when order placed after US transition date', () => {
      const usTimeline = createMetaobjectList([{ cutoff: null, shipping: '2025-02-01' }]);
      const transitionDate = { id: 'gid://shopify/Metafield/1', namespace: 'custom', key: 'inStockToPreOrderUSTransitionDate', value: '2025-01-15', type: 'date', reference: null };

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-20'), // After transition
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: null,
          inStockToPreOrderUSTransitionDate: transitionDate,
          inStockToPreOrderWWTransitionDate: null,
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      expect(timeline.isEmpty()).toBe(false);
      expect(timeline.getBatches().length).toBe(1);
    });

    it('should return timeline when order placed exactly on transition date', () => {
      const usTimeline = createMetaobjectList([{ cutoff: null, shipping: '2025-02-01' }]);
      const transitionDate = { id: 'gid://shopify/Metafield/1', namespace: 'custom', key: 'inStockToPreOrderUSTransitionDate', value: '2025-01-15', type: 'date', reference: null };

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-15'), // On transition date
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: null,
          inStockToPreOrderUSTransitionDate: transitionDate,
          inStockToPreOrderWWTransitionDate: null,
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      expect(timeline.isEmpty()).toBe(false);
      expect(timeline.getBatches().length).toBe(1);
    });

    it('should return empty timeline when order placed before WW transition date', () => {
      const wwTimeline = createMetaobjectList([{ cutoff: null, shipping: '2025-02-01' }]);
      const transitionDate = { id: 'gid://shopify/Metafield/1', namespace: 'custom', key: 'inStockToPreOrderWWTransitionDate', value: '2025-01-15', type: 'date', reference: null };

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'CA',
        new Date('2025-01-10'), // Before transition
        {
          preOrderWWTimeline: wwTimeline,
          preOrderUSTimeline: null,
          inStockToPreOrderWWTransitionDate: transitionDate,
          inStockToPreOrderUSTransitionDate: null,
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      expect(timeline.isEmpty()).toBe(true);
    });

    it('should return empty timeline when no transition date exists', () => {
      const usTimeline = createMetaobjectList([{ cutoff: null, shipping: '2025-02-01' }]);

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-01'),
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: null,
          inStockToPreOrderUSTransitionDate: null,
          inStockToPreOrderWWTransitionDate: null,
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      expect(timeline.isEmpty()).toBe(true);
    });

    it('should return empty timeline when transition date is null', () => {
      const usTimeline = createMetaobjectList([{ cutoff: null, shipping: '2025-02-01' }]);

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-01'),
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: null,
          inStockToPreOrderUSTransitionDate: null,
          inStockToPreOrderWWTransitionDate: null,
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      expect(timeline.isEmpty()).toBe(true);
    });
  });

  describe('orderDate preservation', () => {
    it('should preserve custom orderDate in returned timeline', () => {
      const usTimeline = createMetaobjectList([{ cutoff: null, shipping: '2025-02-01' }]);
      const customDate = new Date('2025-01-15T10:30:00Z');

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        customDate,
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: null,
          inStockToPreOrderUSTransitionDate: { id: 'gid://shopify/Metafield/1', namespace: 'custom', key: 'transition', value: '2025-01-01', type: 'date', reference: null },
          inStockToPreOrderWWTransitionDate: null,
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      expect(timeline.getOrderDate()).toEqual(customDate);
    });
  });

  describe('error handling', () => {
    it('should return empty timeline on parsing error', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const invalidTimeline: Metafield = {
        id: 'gid://shopify/Metafield/123',
        namespace: 'custom',
        key: 'pre_order_timeline',
        type: 'list.metaobject_reference',
        value: 'gid://shopify/Metaobject/123',
        reference: null,
        references: [
          {
            id: 'gid://shopify/Metaobject/1',
            fields: [
              { key: 'estimatedShippingDate', value: 'completely-invalid', type: 'date', reference: null }
            ]
          }
        ]
      };

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-01'),
        {
          preOrderUSTimeline: invalidTimeline,
          preOrderWWTimeline: null,
          inStockToPreOrderUSTransitionDate: null,
          inStockToPreOrderWWTransitionDate: null,
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      // With resilient filtering, invalid batches are filtered out, resulting in empty timeline
      expect(timeline.isEmpty()).toBe(true);

      consoleErrorSpy.mockRestore();
    });

    it('should log error and return empty timeline on exception in try-catch', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // This will cause an error when accessing .value on undefined
      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-01'),
        {
          preOrderUSTimeline: { references: [] } as any,
          preOrderWWTimeline: null,
          inStockToPreOrderUSTransitionDate: null,
          inStockToPreOrderWWTransitionDate: null,
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      // Should handle gracefully and return empty timeline
      expect(timeline).toBeDefined();
      expect(timeline.isEmpty()).toBe(true);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete US customer flow with all data', () => {
      const usTimeline = createMetaobjectList([
        { cutoff: '2025-01-15', shipping: '2025-02-01' },
        { cutoff: '2025-02-15', shipping: '2025-03-01' },
        { cutoff: null, shipping: '2025-04-01' }
      ]);

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'US',
        new Date('2025-01-20'),
        {
          preOrderUSTimeline: usTimeline,
          preOrderWWTimeline: createMetaobjectList([{ cutoff: null, shipping: '2025-05-01' }]),
          inStockToPreOrderUSTransitionDate: { id: 'gid://shopify/Metafield/1', namespace: 'custom', key: 'transition', value: '2025-01-10', type: 'date', reference: null },
          inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/2', namespace: 'custom', key: 'transition', value: '2025-01-10', type: 'date', reference: null },
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      const batches = timeline.getBatches();
      expect(batches.length).toBe(3);
      expect(batches[0].orderCutoffDate).toEqual(new Date('2025-01-15'));
      expect(batches[1].orderCutoffDate).toEqual(new Date('2025-02-15'));
      expect(batches[2].orderCutoffDate).toBeNull();
    });

    it('should handle international customer with deduplication', () => {
      const wwTimeline = createMetaobjectList([
        { cutoff: '2025-01-15', shipping: '2025-02-01' },
        { cutoff: null, shipping: '2025-03-01' },
        { cutoff: null, shipping: '2025-04-01' } // Should be deduplicated to latest
      ]);

      const timeline = PreOrderTimeline.getByDateAndLocation(
        'GB',
        new Date('2025-01-20'),
        {
          preOrderWWTimeline: wwTimeline,
          preOrderUSTimeline: null,
          inStockToPreOrderWWTransitionDate: { id: 'gid://shopify/Metafield/1', namespace: 'custom', key: 'transition', value: '2025-01-10', type: 'date', reference: null },
          inStockToPreOrderUSTransitionDate: null,
          isFulfillingFromUS: null,
          processingTimeString: null
        }
      );

      const batches = timeline.getBatches();
      expect(batches.length).toBe(2); // 1 closed + 1 deduplicated open-ended
      expect(batches[0].orderCutoffDate).toEqual(new Date('2025-01-15'));
      expect(batches[1].orderCutoffDate).toBeNull();
      expect(batches[1].estimatedShippingDate).toEqual(new Date('2025-04-01')); // Latest kept
    });
  });
});

describe('PreOrderTimeline instance methods', () => {
  describe('getBatchForOrderDate', () => {
    it('should return first batch when order date is before all cutoff dates', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([
          { cutoff: '2025-02-01', shipping: '2025-03-01' },
          { cutoff: '2025-03-01', shipping: '2025-04-01' }
        ]),
        new Date('2025-01-15')
      );

      const batch = timeline.getBatchForOrderDate();
      expect(batch).not.toBeNull();
      expect(batch?.orderCutoffDate).toEqual(new Date('2025-02-01'));
    });

    it('should return second batch when order date is after first cutoff', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([
          { cutoff: '2025-02-01', shipping: '2025-03-01' },
          { cutoff: '2025-03-01', shipping: '2025-04-01' }
        ]),
        new Date('2025-02-15')
      );

      const batch = timeline.getBatchForOrderDate();
      expect(batch).not.toBeNull();
      expect(batch?.orderCutoffDate).toEqual(new Date('2025-03-01'));
    });

    it('should return batch when order date equals cutoff date', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([
          { cutoff: '2025-02-01', shipping: '2025-03-01' },
          { cutoff: '2025-03-01', shipping: '2025-04-01' }
        ]),
        new Date('2025-02-01')
      );

      const batch = timeline.getBatchForOrderDate();
      expect(batch).not.toBeNull();
      expect(batch?.orderCutoffDate).toEqual(new Date('2025-02-01'));
    });

    it('should return open-ended batch when order date is after all cutoffs', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([
          { cutoff: '2025-02-01', shipping: '2025-03-01' },
          { cutoff: null, shipping: '2025-04-01' }
        ]),
        new Date('2025-03-15')
      );

      const batch = timeline.getBatchForOrderDate();
      expect(batch).not.toBeNull();
      expect(batch?.orderCutoffDate).toBeNull();
    });

    it('should return open-ended batch when only open-ended batch exists', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([
          { cutoff: null, shipping: '2025-04-01' }
        ]),
        new Date('2025-01-15')
      );

      const batch = timeline.getBatchForOrderDate();
      expect(batch).not.toBeNull();
      expect(batch?.orderCutoffDate).toBeNull();
    });

    it('should return null for empty timeline', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(null);

      const batch = timeline.getBatchForOrderDate();
      expect(batch).toBeNull();
    });
  });

  describe('getEstimatedShippingDate', () => {
    it('should return shipping date from applicable batch', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([
          { cutoff: '2025-02-01', shipping: '2025-03-01' },
          { cutoff: null, shipping: '2025-04-01' }
        ]),
        new Date('2025-01-15')
      );

      const shippingDate = timeline.getEstimatedShippingDate();
      expect(shippingDate).toEqual(new Date('2025-03-01'));
    });

    it('should return null when timeline is empty', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(null);

      const shippingDate = timeline.getEstimatedShippingDate();
      expect(shippingDate).toBeNull();
    });

    it('should return correct date for order after first cutoff', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([
          { cutoff: '2025-02-01', shipping: '2025-03-01' },
          { cutoff: '2025-03-01', shipping: '2025-04-01' }
        ]),
        new Date('2025-02-15')
      );

      const shippingDate = timeline.getEstimatedShippingDate();
      expect(shippingDate).toEqual(new Date('2025-04-01'));
    });
  });

  describe('getFormattedShippingDate', () => {
    it('should format early month dates (1-10)', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-01-05' }]),
        new Date('2025-01-01')
      );

      expect(timeline.getFormattedShippingDate()).toBe('early January');
    });

    it('should format mid month dates (11-20)', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-02-15' }]),
        new Date('2025-01-01')
      );

      expect(timeline.getFormattedShippingDate()).toBe('mid February');
    });

    it('should format late month dates (21-31)', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-03-25' }]),
        new Date('2025-01-01')
      );

      expect(timeline.getFormattedShippingDate()).toBe('late March');
    });

    it('should handle day 1 as early', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-04-01T12:00:00Z' }]),
        new Date('2025-01-01')
      );

      expect(timeline.getFormattedShippingDate()).toBe('early April');
    });

    it('should handle day 10 as early', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-05-10T12:00:00Z' }]),
        new Date('2025-01-01')
      );

      expect(timeline.getFormattedShippingDate()).toBe('early May');
    });

    it('should handle day 11 as mid', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-06-11T12:00:00Z' }]),
        new Date('2025-01-01')
      );

      expect(timeline.getFormattedShippingDate()).toBe('mid June');
    });

    it('should handle day 20 as mid', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-07-20T12:00:00Z' }]),
        new Date('2025-01-01')
      );

      expect(timeline.getFormattedShippingDate()).toBe('mid July');
    });

    it('should handle day 21 as late', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-08-21T12:00:00Z' }]),
        new Date('2025-01-01')
      );

      expect(timeline.getFormattedShippingDate()).toBe('late August');
    });

    it('should handle day 31 as late', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-12-31' }]),
        new Date('2025-01-01')
      );

      expect(timeline.getFormattedShippingDate()).toBe('late December');
    });

    it('should return null when timeline is empty', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(null);

      expect(timeline.getFormattedShippingDate()).toBeNull();
    });

    it('should return null when no applicable batch', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([]),
        new Date('2025-01-01')
      );

      expect(timeline.getFormattedShippingDate()).toBeNull();
    });

    it('should format different months correctly', () => {
      const months = [
        { date: '2025-01-15', expected: 'mid January' },
        { date: '2025-02-05', expected: 'early February' },
        { date: '2025-03-25', expected: 'late March' },
        { date: '2025-04-12', expected: 'mid April' },
        { date: '2025-05-30', expected: 'late May' },
        { date: '2025-06-08', expected: 'early June' },
        { date: '2025-07-18', expected: 'mid July' },
        { date: '2025-08-22', expected: 'late August' },
        { date: '2025-09-03', expected: 'early September' },
        { date: '2025-10-14', expected: 'mid October' },
        { date: '2025-11-28', expected: 'late November' },
        { date: '2025-12-10', expected: 'early December' }
      ];

      months.forEach(({ date, expected }) => {
        const timeline = PreOrderTimeline.fromMetaobjectList(
          createMetaobjectList([{ cutoff: null, shipping: date }]),
          new Date('2025-01-01')
        );
        expect(timeline.getFormattedShippingDate()).toBe(expected);
      });
    });

    describe('with format options', () => {
      describe('month format', () => {
        it('should format with long month names by default', () => {
          const timeline = PreOrderTimeline.fromMetaobjectList(
            createMetaobjectList([{ cutoff: null, shipping: '2025-01-15' }]),
            new Date('2025-01-01')
          );

          expect(timeline.getFormattedShippingDate()).toBe('mid January');
          expect(timeline.getFormattedShippingDate({ month: 'long' })).toBe('mid January');
        });

        it('should format with short month names when specified', () => {
          const timeline = PreOrderTimeline.fromMetaobjectList(
            createMetaobjectList([{ cutoff: null, shipping: '2025-01-15' }]),
            new Date('2025-01-01')
          );

          expect(timeline.getFormattedShippingDate({ month: 'short' })).toBe('mid Jan');
        });

        it('should format different months with short names', () => {
          const months = [
            { date: '2025-01-05', expected: 'early Jan' },
            { date: '2025-02-15', expected: 'mid Feb' },
            { date: '2025-03-25', expected: 'late Mar' },
            { date: '2025-04-10', expected: 'early Apr' },
            { date: '2025-05-20', expected: 'mid May' },
            { date: '2025-06-30', expected: 'late Jun' },
            { date: '2025-07-08', expected: 'early Jul' },
            { date: '2025-08-18', expected: 'mid Aug' },
            { date: '2025-09-28', expected: 'late Sep' },
            { date: '2025-10-05', expected: 'early Oct' },
            { date: '2025-11-15', expected: 'mid Nov' },
            { date: '2025-12-25', expected: 'late Dec' }
          ];

          months.forEach(({ date, expected }) => {
            const timeline = PreOrderTimeline.fromMetaobjectList(
              createMetaobjectList([{ cutoff: null, shipping: date }]),
              new Date('2025-01-01')
            );
            expect(timeline.getFormattedShippingDate({ month: 'short' })).toBe(expected);
          });
        });
      });

      describe('capitalize option', () => {
        it('should not capitalize period by default', () => {
          const timeline = PreOrderTimeline.fromMetaobjectList(
            createMetaobjectList([{ cutoff: null, shipping: '2025-01-05' }]),
            new Date('2025-01-01')
          );

          expect(timeline.getFormattedShippingDate()).toBe('early January');
          expect(timeline.getFormattedShippingDate({ capitalize: false })).toBe('early January');
        });

        it('should capitalize period when specified', () => {
          const timeline = PreOrderTimeline.fromMetaobjectList(
            createMetaobjectList([{ cutoff: null, shipping: '2025-01-05' }]),
            new Date('2025-01-01')
          );

          expect(timeline.getFormattedShippingDate({ capitalize: true })).toBe('Early January');
        });

        it('should capitalize all periods correctly', () => {
          const testCases = [
            { date: '2025-01-05', expectedCapitalized: 'Early January', expectedLowercase: 'early January' },
            { date: '2025-02-15', expectedCapitalized: 'Mid February', expectedLowercase: 'mid February' },
            { date: '2025-03-25', expectedCapitalized: 'Late March', expectedLowercase: 'late March' }
          ];

          testCases.forEach(({ date, expectedCapitalized, expectedLowercase }) => {
            const timeline = PreOrderTimeline.fromMetaobjectList(
              createMetaobjectList([{ cutoff: null, shipping: date }]),
              new Date('2025-01-01')
            );
            expect(timeline.getFormattedShippingDate({ capitalize: true })).toBe(expectedCapitalized);
            expect(timeline.getFormattedShippingDate({ capitalize: false })).toBe(expectedLowercase);
          });
        });
      });

      describe('combined options', () => {
        it('should format with short month and capitalize', () => {
          const timeline = PreOrderTimeline.fromMetaobjectList(
            createMetaobjectList([{ cutoff: null, shipping: '2025-01-15' }]),
            new Date('2025-01-01')
          );

          expect(timeline.getFormattedShippingDate({ month: 'short', capitalize: true })).toBe('Mid Jan');
        });

        it('should format with short month and no capitalize', () => {
          const timeline = PreOrderTimeline.fromMetaobjectList(
            createMetaobjectList([{ cutoff: null, shipping: '2025-01-15' }]),
            new Date('2025-01-01')
          );

          expect(timeline.getFormattedShippingDate({ month: 'short', capitalize: false })).toBe('mid Jan');
        });

        it('should format with long month and capitalize', () => {
          const timeline = PreOrderTimeline.fromMetaobjectList(
            createMetaobjectList([{ cutoff: null, shipping: '2025-01-15' }]),
            new Date('2025-01-01')
          );

          expect(timeline.getFormattedShippingDate({ month: 'long', capitalize: true })).toBe('Mid January');
        });

        it('should handle all combinations for different periods', () => {
          const testCases = [
            {
              date: '2025-01-05',
              combinations: [
                { options: { month: 'long' as const, capitalize: false }, expected: 'early January' },
                { options: { month: 'long' as const, capitalize: true }, expected: 'Early January' },
                { options: { month: 'short' as const, capitalize: false }, expected: 'early Jan' },
                { options: { month: 'short' as const, capitalize: true }, expected: 'Early Jan' }
              ]
            },
            {
              date: '2025-02-15',
              combinations: [
                { options: { month: 'long' as const, capitalize: false }, expected: 'mid February' },
                { options: { month: 'long' as const, capitalize: true }, expected: 'Mid February' },
                { options: { month: 'short' as const, capitalize: false }, expected: 'mid Feb' },
                { options: { month: 'short' as const, capitalize: true }, expected: 'Mid Feb' }
              ]
            },
            {
              date: '2025-03-25',
              combinations: [
                { options: { month: 'long' as const, capitalize: false }, expected: 'late March' },
                { options: { month: 'long' as const, capitalize: true }, expected: 'Late March' },
                { options: { month: 'short' as const, capitalize: false }, expected: 'late Mar' },
                { options: { month: 'short' as const, capitalize: true }, expected: 'Late Mar' }
              ]
            }
          ];

          testCases.forEach(({ date, combinations }) => {
            const timeline = PreOrderTimeline.fromMetaobjectList(
              createMetaobjectList([{ cutoff: null, shipping: date }]),
              new Date('2025-01-01')
            );

            combinations.forEach(({ options, expected }) => {
              expect(timeline.getFormattedShippingDate(options)).toBe(expected);
            });
          });
        });
      });

      describe('partial options - testing fallback values', () => {
        it('should use default month when only capitalize is provided', () => {
          const timeline = PreOrderTimeline.fromMetaobjectList(
            createMetaobjectList([{ cutoff: null, shipping: '2025-01-15' }]),
            new Date('2025-01-01')
          );

          expect(timeline.getFormattedShippingDate({ capitalize: true })).toBe('Mid January');
          expect(timeline.getFormattedShippingDate({ capitalize: false })).toBe('mid January');
        });

        it('should use default capitalize when only month is provided', () => {
          const timeline = PreOrderTimeline.fromMetaobjectList(
            createMetaobjectList([{ cutoff: null, shipping: '2025-01-15' }]),
            new Date('2025-01-01')
          );

          expect(timeline.getFormattedShippingDate({ month: 'long' })).toBe('mid January');
          expect(timeline.getFormattedShippingDate({ month: 'short' })).toBe('mid Jan');
        });
      });

      describe('null cases with options', () => {
        it('should return null for empty timeline regardless of options', () => {
          const timeline = PreOrderTimeline.fromMetaobjectList(null);

          expect(timeline.getFormattedShippingDate()).toBeNull();
          expect(timeline.getFormattedShippingDate({ month: 'short' })).toBeNull();
          expect(timeline.getFormattedShippingDate({ capitalize: true })).toBeNull();
          expect(timeline.getFormattedShippingDate({ month: 'short', capitalize: true })).toBeNull();
        });

        it('should return null when no applicable batch regardless of options', () => {
          const timeline = PreOrderTimeline.fromMetaobjectList(
            createMetaobjectList([]),
            new Date('2025-01-01')
          );

          expect(timeline.getFormattedShippingDate()).toBeNull();
          expect(timeline.getFormattedShippingDate({ month: 'short' })).toBeNull();
          expect(timeline.getFormattedShippingDate({ capitalize: true })).toBeNull();
          expect(timeline.getFormattedShippingDate({ month: 'short', capitalize: true })).toBeNull();
        });
      });
    });
  });

  describe('getBatches', () => {
    it('should return all batches', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([
          { cutoff: '2025-01-15', shipping: '2025-02-01' },
          { cutoff: '2025-02-15', shipping: '2025-03-01' },
          { cutoff: null, shipping: '2025-04-01' }
        ])
      );

      const batches = timeline.getBatches();
      expect(batches.length).toBe(3);
    });

    it('should return defensive copy (immutability)', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-02-01' }])
      );

      const batches1 = timeline.getBatches();
      const batches2 = timeline.getBatches();

      expect(batches1).toEqual(batches2);
      expect(batches1).not.toBe(batches2); // Different array instances
    });

    it('should return empty array for empty timeline', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(null);

      const batches = timeline.getBatches();
      expect(batches).toEqual([]);
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty timeline', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(null);

      expect(timeline.isEmpty()).toBe(true);
    });

    it('should return false for timeline with batches', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-02-01' }])
      );

      expect(timeline.isEmpty()).toBe(false);
    });

    it('should return false for timeline with multiple batches', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([
          { cutoff: '2025-01-15', shipping: '2025-02-01' },
          { cutoff: null, shipping: '2025-03-01' }
        ])
      );

      expect(timeline.isEmpty()).toBe(false);
    });
  });

  describe('getOrderDate', () => {
    it('should return the order date passed to constructor', () => {
      const orderDate = new Date('2025-01-15T10:30:00Z');
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-02-01' }]),
        orderDate
      );

      expect(timeline.getOrderDate()).toEqual(orderDate);
    });

    it('should return default date when no order date provided', () => {
      const beforeCall = new Date();
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-02-01' }])
      );
      const afterCall = new Date();

      const orderDate = timeline.getOrderDate();
      expect(orderDate.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(orderDate.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });
  });

  describe('hasEstimatedShippingDatePassed', () => {
    it('should return true when current date is after shipping date', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-01-15' }]),
        new Date('2025-01-01')
      );

      const hasPassed = timeline.hasEstimatedShippingDatePassed(new Date('2025-02-01'));
      expect(hasPassed).toBe(true);
    });

    it('should return false when current date is before shipping date', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-02-15' }]),
        new Date('2025-01-01')
      );

      const hasPassed = timeline.hasEstimatedShippingDatePassed(new Date('2025-02-01'));
      expect(hasPassed).toBe(false);
    });

    it('should return true when current date equals shipping date', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-02-15' }]),
        new Date('2025-01-01')
      );

      const hasPassed = timeline.hasEstimatedShippingDatePassed(new Date('2025-02-15'));
      expect(hasPassed).toBe(true);
    });

    it('should return false when no shipping date exists', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(null);

      const hasPassed = timeline.hasEstimatedShippingDatePassed(new Date('2025-02-01'));
      expect(hasPassed).toBe(false);
    });

    it('should use current date when no date parameter provided', () => {
      const pastDate = new Date('2020-01-01');
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: pastDate.toISOString() }]),
        new Date('2020-01-01')
      );

      const hasPassed = timeline.hasEstimatedShippingDatePassed(); // No parameter, uses new Date()
      expect(hasPassed).toBe(true); // Should be true since 2020 is in the past
    });

    it('should work with time components', () => {
      const timeline = PreOrderTimeline.fromMetaobjectList(
        createMetaobjectList([{ cutoff: null, shipping: '2025-02-15T10:00:00Z' }]),
        new Date('2025-01-01')
      );

      const hasPassed1 = timeline.hasEstimatedShippingDatePassed(new Date('2025-02-15T09:00:00Z'));
      expect(hasPassed1).toBe(false);

      const hasPassed2 = timeline.hasEstimatedShippingDatePassed(new Date('2025-02-15T11:00:00Z'));
      expect(hasPassed2).toBe(true);
    });
  });
});
