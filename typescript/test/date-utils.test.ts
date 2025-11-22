import { describe, it, expect } from '@jest/globals';
import { addBusinessDays, convertToDayRange, toDateRangeString } from '../src/date-utils';

// Helper to create a date in local timezone at noon to avoid timezone issues
function createLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0);
}

// Helper to extract the date parts from a Date object in local timezone
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('addBusinessDays', () => {
  describe('basic functionality', () => {
    it('should add business days starting from a Monday', () => {
      // Monday, January 6, 2025
      const startDate = createLocalDate(2025, 1, 6);
      const result = addBusinessDays(startDate, 5);
      // 5 business days later should be Monday, January 13, 2025
      expect(getLocalDateString(result)).toBe('2025-01-13');
    });

    it('should add business days starting from a Wednesday', () => {
      // Wednesday, January 8, 2025
      const startDate = createLocalDate(2025, 1, 8);
      const result = addBusinessDays(startDate, 3);
      // 3 business days later should be Monday, January 13, 2025
      expect(getLocalDateString(result)).toBe('2025-01-13');
    });

    it('should skip weekends when adding days', () => {
      // Friday, January 10, 2025
      const startDate = createLocalDate(2025, 1, 10);
      const result = addBusinessDays(startDate, 1);
      // 1 business day later should be Monday, January 13, 2025 (skipping Sat/Sun)
      expect(getLocalDateString(result)).toBe('2025-01-13');
    });

    it('should handle starting on a Saturday', () => {
      // Saturday, January 11, 2025
      const startDate = createLocalDate(2025, 1, 11);
      const result = addBusinessDays(startDate, 1);
      // 1 business day later should be Monday, January 13, 2025
      expect(getLocalDateString(result)).toBe('2025-01-13');
    });

    it('should handle starting on a Sunday', () => {
      // Sunday, January 12, 2025
      const startDate = createLocalDate(2025, 1, 12);
      const result = addBusinessDays(startDate, 1);
      // 1 business day later should be Monday, January 13, 2025
      expect(getLocalDateString(result)).toBe('2025-01-13');
    });
  });

  describe('edge cases', () => {
    it('should return the same date when adding 0 business days', () => {
      const startDate = createLocalDate(2025, 1, 6);
      const result = addBusinessDays(startDate, 0);
      expect(getLocalDateString(result)).toBe('2025-01-06');
    });

    it('should handle multiple weeks of business days', () => {
      // Monday, January 6, 2025
      const startDate = createLocalDate(2025, 1, 6);
      const result = addBusinessDays(startDate, 10);
      // 10 business days = 2 weeks, should be Monday, January 20, 2025
      expect(getLocalDateString(result)).toBe('2025-01-20');
    });

    it('should not modify the original date', () => {
      const startDate = createLocalDate(2025, 1, 6);
      const originalTime = startDate.getTime();
      addBusinessDays(startDate, 5);
      expect(startDate.getTime()).toBe(originalTime);
    });

    it('should handle crossing month boundaries', () => {
      // Friday, January 31, 2025
      const startDate = createLocalDate(2025, 1, 31);
      const result = addBusinessDays(startDate, 1);
      // 1 business day later should be Monday, February 3, 2025
      expect(getLocalDateString(result)).toBe('2025-02-03');
    });

    it('should handle crossing year boundaries', () => {
      // Tuesday, December 31, 2024
      const startDate = createLocalDate(2024, 12, 31);
      const result = addBusinessDays(startDate, 2);
      // Wed Jan 1, Thu Jan 2 = 2 business days
      expect(getLocalDateString(result)).toBe('2025-01-02');
    });
  });

  describe('larger values', () => {
    it('should correctly calculate 15 business days', () => {
      // Monday, January 6, 2025
      const startDate = createLocalDate(2025, 1, 6);
      const result = addBusinessDays(startDate, 15);
      // 15 business days = 3 weeks, should be Monday, January 27, 2025
      expect(getLocalDateString(result)).toBe('2025-01-27');
    });

    it('should correctly calculate 20 business days', () => {
      // Monday, January 6, 2025
      const startDate = createLocalDate(2025, 1, 6);
      const result = addBusinessDays(startDate, 20);
      // 20 business days = 4 weeks, should be Monday, February 3, 2025
      expect(getLocalDateString(result)).toBe('2025-02-03');
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

describe('toDateRangeString', () => {
  describe('same month formatting', () => {
    it('should format dates in the same month with long format by default', () => {
      const dateRange = {
        earliest: createLocalDate(2025, 2, 2),
        latest: createLocalDate(2025, 2, 14),
      };
      expect(toDateRangeString(dateRange)).toBe('February 2 – 14');
    });

    it('should format dates in the same month with short format when specified', () => {
      const dateRange = {
        earliest: createLocalDate(2025, 2, 2),
        latest: createLocalDate(2025, 2, 14),
      };
      expect(toDateRangeString(dateRange, 'short')).toBe('Feb 2 – 14');
    });

    it('should format single day range in the same month', () => {
      const dateRange = {
        earliest: createLocalDate(2025, 3, 15),
        latest: createLocalDate(2025, 3, 15),
      };
      expect(toDateRangeString(dateRange)).toBe('March 15 – 15');
    });

    it('should handle January dates', () => {
      const dateRange = {
        earliest: createLocalDate(2025, 1, 1),
        latest: createLocalDate(2025, 1, 31),
      };
      expect(toDateRangeString(dateRange)).toBe('January 1 –31');
    });

    it('should handle December dates', () => {
      const dateRange = {
        earliest: createLocalDate(2025, 12, 20),
        latest: createLocalDate(2025, 12, 25),
      };
      expect(toDateRangeString(dateRange)).toBe('December 20 – 25');
    });
  });

  describe('different month formatting', () => {
    it('should format dates in different months with short format', () => {
      const dateRange = {
        earliest: createLocalDate(2025, 2, 14),
        latest: createLocalDate(2025, 3, 1),
      };
      expect(toDateRangeString(dateRange)).toBe('Feb 14 – Mar 1');
    });

    it('should use short format for different months even when long is specified', () => {
      const dateRange = {
        earliest: createLocalDate(2025, 2, 14),
        latest: createLocalDate(2025, 3, 1),
      };
      expect(toDateRangeString(dateRange, 'long')).toBe('Feb 14 – Mar 1');
    });

    it('should handle crossing year boundaries', () => {
      const dateRange = {
        earliest: createLocalDate(2024, 12, 28),
        latest: createLocalDate(2025, 1, 5),
      };
      expect(toDateRangeString(dateRange)).toBe('Dec 28 – Jan 5');
    });

    it('should handle months far apart', () => {
      const dateRange = {
        earliest: createLocalDate(2025, 1, 15),
        latest: createLocalDate(2025, 6, 20),
      };
      expect(toDateRangeString(dateRange)).toBe('Jan 15 – Jun 20');
    });

    it('should handle same month in different years as different months', () => {
      const dateRange = {
        earliest: createLocalDate(2024, 12, 15),
        latest: createLocalDate(2025, 12, 15),
      };
      expect(toDateRangeString(dateRange)).toBe('Dec 15 –Dec 15');
    });
  });

  describe('edge cases', () => {
    it('should handle first day of month to last day of next month', () => {
      const dateRange = {
        earliest: createLocalDate(2025, 3, 1),
        latest: createLocalDate(2025, 4, 30),
      };
      expect(toDateRangeString(dateRange)).toBe('Mar 1 – Apr 30');
    });

    it('should handle leap year February', () => {
      const dateRange = {
        earliest: createLocalDate(2024, 2, 28),
        latest: createLocalDate(2024, 2, 29),
      };
      expect(toDateRangeString(dateRange)).toBe('February 28 – 29');
    });

    it('should handle leap year February to March', () => {
      const dateRange = {
        earliest: createLocalDate(2024, 2, 29),
        latest: createLocalDate(2024, 3, 1),
      };
      expect(toDateRangeString(dateRange)).toBe('Feb 29 –Mar 1');
    });
  });
});
