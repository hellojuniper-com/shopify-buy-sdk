import { describe, it, expect } from '@jest/globals';
import { getProcessingByLocation, getDeliveryByLocation, getHolidayOrderCuttoffByLocation } from '../src/config-utils';
import { DayRange, DeliveryConfig, ProcessingConfig, HolidayOrderCutoffConfig } from '../shared/types';

describe('getProcessingByLocation', () => {
  describe('with default config', () => {
    it('should return US processing times for US origin', () => {
      const result = getProcessingByLocation('US');
      expect(result).toEqual({ minDays: 1, maxDays: 3 });
    });

    it('should return CN processing times for CN origin', () => {
      const result = getProcessingByLocation('CN');
      expect(result).toEqual({ minDays: 1, maxDays: 3 });
    });

    it('should return US processing times for unknown origin', () => {
      const result = getProcessingByLocation('UNKNOWN');
      expect(result).toEqual({ minDays: 1, maxDays: 3 });
    });

    it('should return US processing times for empty string', () => {
      const result = getProcessingByLocation('');
      expect(result).toEqual({ minDays: 1, maxDays: 3 });
    });
  });

  describe('with custom config', () => {
    const customConfig: ProcessingConfig = {
      "US": { minDays: 2, maxDays: 4 },
      "CN": { minDays: 3, maxDays: 5 }
    };

    it('should return custom US processing times', () => {
      const result = getProcessingByLocation('US', customConfig);
      expect(result).toEqual({ minDays: 2, maxDays: 4 });
    });

    it('should return custom CN processing times', () => {
      const result = getProcessingByLocation('CN', customConfig);
      expect(result).toEqual({ minDays: 3, maxDays: 5 });
    });

    it('should fallback to US for unknown origin', () => {
      const result = getProcessingByLocation('UK', customConfig);
      expect(result).toEqual({ minDays: 2, maxDays: 4 });
    });
  });
});

describe('getDeliveryByLocation', () => {
  describe('with default config', () => {
    it('should return US to US delivery times', () => {
      const result = getDeliveryByLocation('US', 'US');
      expect(result).toEqual({ minDays: 3, maxDays: 5 });
    });

    it('should return US to WW delivery times (fallback from CA as destination)', () => {
      const result = getDeliveryByLocation('US', 'CA');
      expect(result).toEqual({ minDays: 7, maxDays: 14 });
    });

    it('should return CN to US delivery times', () => {
      const result = getDeliveryByLocation('CN', 'US');
      expect(result).toEqual({ minDays: 7, maxDays: 14 });
    });

    it('should return CN to GB delivery times', () => {
      const result = getDeliveryByLocation('CN', 'GB');
      expect(result).toEqual({ minDays: 5, maxDays: 8 });
    });

    it('should return CN to WW delivery times (fallback from CA as destination)', () => {
      const result = getDeliveryByLocation('CN', 'CA');
      expect(result).toEqual({ minDays: 7, maxDays: 14 });
    });

    it('should return CN to WW delivery times', () => {
      const result = getDeliveryByLocation('CN', 'WW');
      expect(result).toEqual({ minDays: 7, maxDays: 14 });
    });

    it('should fallback to CN-WW for unknown origin', () => {
      const result = getDeliveryByLocation('UNKNOWN', 'US');
      expect(result).toEqual({ minDays: 7, maxDays: 14 });
    });

    it('should fallback to CN-US for unknown destination with CN origin', () => {
      const result = getDeliveryByLocation('CN', 'UNKNOWN');
      expect(result).toEqual({ minDays: 7, maxDays: 14 });
    });

    it('should fallback to CN-US for US origin to unknown destination', () => {
      const result = getDeliveryByLocation('US', 'UNKNOWN');
      expect(result).toEqual({ minDays: 7, maxDays: 14 });
    });
  });

  describe('with custom config', () => {
    const customConfig: DeliveryConfig = {
      "US": {
        "US": { minDays: 1, maxDays: 3 },
        "WW": { minDays: 5, maxDays: 10 }
      },
      "CN": {
        "US": { minDays: 10, maxDays: 20 },
        "GB": { minDays: 7, maxDays: 10 },
        "WW": { minDays: 10, maxDays: 15 }
      }
    };

    it('should return custom US to US delivery times', () => {
      const result = getDeliveryByLocation('US', 'US', customConfig);
      expect(result).toEqual({ minDays: 1, maxDays: 3 });
    });

    it('should fallback to US-WW for unknown destination only', () => {
      const result = getDeliveryByLocation('US', 'UNKNOWN', customConfig);
      expect(result).toEqual({ minDays: 5, maxDays: 10 });
    });

    it('should return custom CN to US delivery times', () => {
      const result = getDeliveryByLocation('CN', 'US', customConfig);
      expect(result).toEqual({ minDays: 10, maxDays: 20 });
    });

    it('should return custom CN to GB delivery times', () => {
      const result = getDeliveryByLocation('CN', 'GB', customConfig);
      expect(result).toEqual({ minDays: 7, maxDays: 10 });
    });

    it('should return custom CN to WW delivery times (fallback for CA destination)', () => {
      const result = getDeliveryByLocation('CN', 'CA', customConfig);
      expect(result).toEqual({ minDays: 10, maxDays: 15 });
    });

    it('should fallback to CN-WW for unknown combinations', () => {
      const result = getDeliveryByLocation('UNKNOWN', 'UNKNOWN', customConfig);
      expect(result).toEqual({ minDays: 10, maxDays: 15 });
    });
  });
});

describe('getHolidayOrderCuttoffByLocation', () => {
  describe('with default config', () => {
    it('should return US to US holiday cutoff date', () => {
      const result = getHolidayOrderCuttoffByLocation('US', 'US');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2025-12-12T05:00:00.000Z');
    });

    it('should return CN to US holiday cutoff date', () => {
      const result = getHolidayOrderCuttoffByLocation('CN', 'US');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2025-12-03T05:00:00.000Z');
    });

    it('should return CN to GB holiday cutoff date', () => {
      const result = getHolidayOrderCuttoffByLocation('CN', 'GB');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2025-12-05T05:00:00.000Z');
    });

    it('should return CN to WW holiday cutoff date', () => {
      const result = getHolidayOrderCuttoffByLocation('CN', 'WW');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2025-12-03T05:00:00.000Z');
    });

    it('should fallback to CN-WW for unknown origin', () => {
      const result = getHolidayOrderCuttoffByLocation('UNKNOWN', 'US');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2025-12-03T05:00:00.000Z');
    });

    it('should fallback to CN-WW for unknown destination with CN origin', () => {
      const result = getHolidayOrderCuttoffByLocation('CN', 'UNKNOWN');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2025-12-03T05:00:00.000Z');
    });

    it('should fallback to CN-WW for US origin to unknown destination', () => {
      const result = getHolidayOrderCuttoffByLocation('US', 'UK');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2025-12-03T05:00:00.000Z');
    });
  });

  describe('with custom config', () => {
    const customConfig: HolidayOrderCutoffConfig = {
      "US": {
        "US": "2025-12-15T00:00:00-05:00",
        "WW": "2025-12-10T00:00:00-05:00"
      },
      "CN": {
        "US": "2025-12-01T00:00:00-05:00",
        "GB": "2025-12-02T00:00:00-05:00",
        "WW": "2025-11-30T00:00:00-05:00"
      }
    };

    it('should return custom US to US holiday cutoff date', () => {
      const result = getHolidayOrderCuttoffByLocation('US', 'US', customConfig);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2025-12-15T05:00:00.000Z');
    });

    it('should return US to WW holiday cutoff dates', () => {
      const result = getHolidayOrderCuttoffByLocation('US', 'WW', customConfig);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2025-12-10T05:00:00.000Z');
    });

    it('should fallback to custom US-WW for unknown destination', () => {
      const result = getHolidayOrderCuttoffByLocation('US', 'UNKNOWN', customConfig);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2025-12-10T05:00:00.000Z');
    });

    it('should return custom CN to US holiday cutoff date', () => {
      const result = getHolidayOrderCuttoffByLocation('CN', 'US', customConfig);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2025-12-01T05:00:00.000Z');
    });

    it('should return custom CN to GB holiday cutoff date', () => {
      const result = getHolidayOrderCuttoffByLocation('CN', 'GB', customConfig);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2025-12-02T05:00:00.000Z');
    });

    it('should return custom CN to WW holiday cutoff date', () => {
      const result = getHolidayOrderCuttoffByLocation('CN', 'WW', customConfig);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2025-11-30T05:00:00.000Z');
    });

    it('should fallback to custom CN-WW for unknown combinations', () => {
      const result = getHolidayOrderCuttoffByLocation('UNKNOWN', 'UNKNOWN', customConfig);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2025-11-30T05:00:00.000Z');
    });
  });
});
