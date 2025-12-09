import { describe, it, expect } from '@jest/globals';
import { ShippingInfo } from '../src/shipping-info';
import {
  VariantShippingMetafields,
  Metafield,
  DeliveryConfig,
  ProcessingConfig,
  HolidayOrderCutoffConfig
} from '../shared/types';

// Helper function to create metafields for testing
function createVariantShippingMetafields(
  preOrderWWTimeline: Metafield | null = null,
  preOrderUSTimeline: Metafield | null = null,
  inStockToPreOrderWWTransitionDate: Metafield | null = null,
  inStockToPreOrderUSTransitionDate: Metafield | null = null,
  isFulfillingFromUS: Metafield | null = null,
  processingTimeString: Metafield | null = null
): VariantShippingMetafields {
  return {
    preOrderWWTimeline,
    preOrderUSTimeline,
    inStockToPreOrderWWTransitionDate,
    inStockToPreOrderUSTransitionDate,
    isFulfillingFromUS,
    processingTimeString
  };
}

function createMetafield(value: string | null): Metafield {
  return {
    id: 'gid://shopify/Metafield/123',
    namespace: 'custom',
    key: 'test',
    type: 'string',
    value,
    reference: null,
    references: null
  };
}

describe('ShippingInfo', () => {
  describe('constructor', () => {
    it('should create instance with all required properties', () => {
      const orderDate = new Date('2025-01-15');
      const preOrderShipOutDate = new Date('2025-02-01');
      const processingInfo = { minDays: 1, maxDays: 3 };
      const deliveryInfo = { minDays: 7, maxDays: 16 };
      const holidayOrderCutoff = new Date('2025-12-12');

      const shippingInfo = new ShippingInfo(
        orderDate,
        preOrderShipOutDate,
        processingInfo,
        deliveryInfo,
        'CN',
        'US',
        holidayOrderCutoff
      );

      expect(shippingInfo).toBeInstanceOf(ShippingInfo);
    });
  });

  describe('isInStock', () => {
    it('should return true when preOrderShipOutDate is null', () => {
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        null,
        { minDays: 1, maxDays: 3 },
        { minDays: 7, maxDays: 16 },
        'US',
        'US',
        new Date('2025-12-12')
      );

      expect(shippingInfo.isInStock()).toBe(true);
    });

    it('should return false when preOrderShipOutDate is set', () => {
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        new Date('2025-02-01'),
        { minDays: 1, maxDays: 3 },
        { minDays: 7, maxDays: 16 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      expect(shippingInfo.isInStock()).toBe(false);
    });

    it('should return true when preOrderShipOutDate is before orderDate', () => {
      const shippingInfo = new ShippingInfo(
        new Date('2025-02-01'),  // orderDate
        new Date('2025-01-15'),  // preOrderShipOutDate (before orderDate)
        { minDays: 1, maxDays: 3 },
        { minDays: 7, maxDays: 16 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      expect(shippingInfo.isInStock()).toBe(true);
    });
  });

  describe('getShipOutDate', () => {
    it('should return orderDate + maxProcessingDays (business days) for in-stock items', () => {
      // Monday, January 6, 2025 at noon to avoid timezone issues
      const orderDate = new Date(2025, 0, 6, 12, 0, 0);
      const shippingInfo = new ShippingInfo(
        orderDate,
        null,
        { minDays: 3, maxDays: 5 },
        { minDays: 7, maxDays: 16 },
        'US',
        'US',
        new Date('2025-12-12')
      );

      const shipOutDate = shippingInfo.getShipOutDate();
      // 5 business days from Monday Jan 6: Tue(1), Wed(2), Thu(3), Fri(4), Mon(5) = Jan 13
      expect(shipOutDate.getFullYear()).toBe(2025);
      expect(shipOutDate.getMonth()).toBe(0); // January
      expect(shipOutDate.getDate()).toBe(13);
    });

    it('should return preOrderShipOutDate for pre-order items', () => {
      const preOrderShipOutDate = new Date('2025-02-01');
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        preOrderShipOutDate,
        { minDays: 1, maxDays: 3 },
        { minDays: 7, maxDays: 16 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      const shipOutDate = shippingInfo.getShipOutDate();
      expect(shipOutDate.toISOString()).toBe('2025-02-01T00:00:00.000Z');
    });

    it('should return a new Date object, not the original reference', () => {
      const preOrderShipOutDate = new Date('2025-02-01');
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        preOrderShipOutDate,
        { minDays: 1, maxDays: 3 },
        { minDays: 7, maxDays: 16 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      const shipOutDate = shippingInfo.getShipOutDate();
      shipOutDate.setDate(shipOutDate.getDate() + 10);

      // Original should not be modified
      expect(shippingInfo.getShipOutDate().toISOString()).toBe('2025-02-01T00:00:00.000Z');
    });

    it('should return orderDate + maxProcessingDays when preOrderShipOutDate is before orderDate', () => {
      // Monday, February 3, 2025 at noon
      const orderDate = new Date(2025, 1, 3, 12, 0, 0);
      const preOrderShipOutDate = new Date(2025, 0, 15, 12, 0, 0); // Jan 15 - before order date
      const shippingInfo = new ShippingInfo(
        orderDate,
        preOrderShipOutDate,
        { minDays: 1, maxDays: 3 },
        { minDays: 7, maxDays: 16 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      const shipOutDate = shippingInfo.getShipOutDate();
      // Should use in-stock logic: 3 business days from Mon Feb 3 = Thu Feb 6
      expect(shipOutDate.getFullYear()).toBe(2025);
      expect(shipOutDate.getMonth()).toBe(1); // February
      expect(shipOutDate.getDate()).toBe(6);
    });
  });

  describe('getArrivalDate', () => {
    it('should return shipOutDate + maxDeliveryDays (business days) for in-stock items', () => {
      // Monday, January 6, 2025 at noon to avoid timezone issues
      const orderDate = new Date(2025, 0, 6, 12, 0, 0);
      const shippingInfo = new ShippingInfo(
        orderDate,
        null,
        { minDays: 1, maxDays: 3 },
        { minDays: 7, maxDays: 10 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      const arrivalDate = shippingInfo.getArrivalDate();
      // Ship out: 3 business days from Mon Jan 6 = Thu Jan 9
      // Arrival: 10 business days from Jan 9 = Thu Jan 23
      expect(arrivalDate.getFullYear()).toBe(2025);
      expect(arrivalDate.getMonth()).toBe(0); // January
      expect(arrivalDate.getDate()).toBe(23);
    });

    it('should return preOrderShipOutDate + maxDeliveryDays (business days) for pre-order items', () => {
      // Monday, February 3, 2025 at noon to avoid timezone issues
      const preOrderShipOutDate = new Date(2025, 1, 3, 12, 0, 0);
      const shippingInfo = new ShippingInfo(
        new Date(2025, 0, 15, 12, 0, 0),
        preOrderShipOutDate,
        { minDays: 1, maxDays: 3 },
        { minDays: 7, maxDays: 10 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      const arrivalDate = shippingInfo.getArrivalDate();
      // Pre-order ship out Monday Feb 3 + 10 business days = Mon Feb 17
      expect(arrivalDate.getFullYear()).toBe(2025);
      expect(arrivalDate.getMonth()).toBe(1); // February
      expect(arrivalDate.getDate()).toBe(17);
    });
  });

  describe('getArrivalDateRange', () => {
    it('should return earliest and latest arrival dates for in-stock items', () => {
      // Monday, January 6, 2025 at noon to avoid timezone issues
      const orderDate = new Date(2025, 0, 6, 12, 0, 0);
      const shippingInfo = new ShippingInfo(
        orderDate,
        null,
        { minDays: 1, maxDays: 3 },
        { minDays: 5, maxDays: 10 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      const dateRange = shippingInfo.getArrivalDateRange();

      // For in-stock items: processing + delivery days from order date
      // Earliest: 1 + 5 = 6 business days from Mon Jan 6 = Tue Jan 14
      expect(dateRange.earliest.getFullYear()).toBe(2025);
      expect(dateRange.earliest.getMonth()).toBe(0); // January
      expect(dateRange.earliest.getDate()).toBe(14);

      // Latest: 3 + 10 = 13 business days from Mon Jan 6 = Thu Jan 23
      expect(dateRange.latest.getFullYear()).toBe(2025);
      expect(dateRange.latest.getMonth()).toBe(0); // January
      expect(dateRange.latest.getDate()).toBe(23);
    });

    it('should return earliest and latest arrival dates for pre-order items', () => {
      // Monday, February 3, 2025 at noon to avoid timezone issues
      const preOrderShipOutDate = new Date(2025, 1, 3, 12, 0, 0);
      const shippingInfo = new ShippingInfo(
        new Date(2025, 0, 15, 12, 0, 0),
        preOrderShipOutDate,
        { minDays: 1, maxDays: 3 },
        { minDays: 5, maxDays: 10 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      const dateRange = shippingInfo.getArrivalDateRange();

      // For pre-order items: delivery days only from ship-out date
      // Earliest: 5 business days from Mon Feb 3 = Mon Feb 10
      expect(dateRange.earliest.getFullYear()).toBe(2025);
      expect(dateRange.earliest.getMonth()).toBe(1); // February
      expect(dateRange.earliest.getDate()).toBe(10);

      // Latest: 10 business days from Mon Feb 3 = Mon Feb 17
      expect(dateRange.latest.getFullYear()).toBe(2025);
      expect(dateRange.latest.getMonth()).toBe(1); // February
      expect(dateRange.latest.getDate()).toBe(17);
    });

    it('should handle weekend skipping correctly', () => {
      // Friday, January 10, 2025 at noon
      const orderDate = new Date(2025, 0, 10, 12, 0, 0);
      const shippingInfo = new ShippingInfo(
        orderDate,
        null,
        { minDays: 1, maxDays: 2 },
        { minDays: 1, maxDays: 2 },
        'US',
        'US',
        new Date('2025-12-12')
      );

      const dateRange = shippingInfo.getArrivalDateRange();

      // Earliest: 2 business days from Fri Jan 10 = Tue Jan 14 (skips weekend)
      expect(dateRange.earliest.getFullYear()).toBe(2025);
      expect(dateRange.earliest.getMonth()).toBe(0); // January
      expect(dateRange.earliest.getDate()).toBe(14);

      // Latest: 4 business days from Fri Jan 10 = Thu Jan 16
      expect(dateRange.latest.getFullYear()).toBe(2025);
      expect(dateRange.latest.getMonth()).toBe(0); // January
      expect(dateRange.latest.getDate()).toBe(16);
    });

    it('should use in-stock calculation when preOrderShipOutDate is before orderDate', () => {
      // Monday, February 3, 2025 at noon
      const orderDate = new Date(2025, 1, 3, 12, 0, 0);
      const preOrderShipOutDate = new Date(2025, 0, 15, 12, 0, 0); // Jan 15 - before order date
      const shippingInfo = new ShippingInfo(
        orderDate,
        preOrderShipOutDate,
        { minDays: 1, maxDays: 3 },
        { minDays: 5, maxDays: 10 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      const dateRange = shippingInfo.getArrivalDateRange();

      // Should use in-stock logic: processing + delivery from order date
      // Earliest: 1 + 5 = 6 business days from Mon Feb 3 = Tue Feb 11
      expect(dateRange.earliest.getFullYear()).toBe(2025);
      expect(dateRange.earliest.getMonth()).toBe(1); // February
      expect(dateRange.earliest.getDate()).toBe(11);

      // Latest: 3 + 10 = 13 business days from Mon Feb 3 = Thu Feb 20
      expect(dateRange.latest.getFullYear()).toBe(2025);
      expect(dateRange.latest.getMonth()).toBe(1); // February
      expect(dateRange.latest.getDate()).toBe(20);
    });
  });

  describe('getArrivalDateRangeString', () => {
    it('should return formatted date range string with long month format (default)', () => {
      // Monday, January 6, 2025
      const orderDate = new Date(2025, 0, 6, 12, 0, 0);
      const shippingInfo = new ShippingInfo(
        orderDate,
        null,
        { minDays: 1, maxDays: 3 },
        { minDays: 5, maxDays: 10 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      const rangeString = shippingInfo.getArrivalDateRangeString();

      // Earliest: Jan 14, Latest: Jan 23 (uses en-dash)
      expect(rangeString).toBe('January 14 – 23');
    });

    it('should return formatted date range string with short month format', () => {
      // Monday, January 6, 2025
      const orderDate = new Date(2025, 0, 6, 12, 0, 0);
      const shippingInfo = new ShippingInfo(
        orderDate,
        null,
        { minDays: 1, maxDays: 3 },
        { minDays: 5, maxDays: 10 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      const rangeString = shippingInfo.getArrivalDateRangeString('short');

      // Earliest: Jan 14, Latest: Jan 23 (uses en-dash)
      expect(rangeString).toBe('Jan 14 – 23');
    });

    it('should include both months when range spans different months', () => {
      // Monday, January 27, 2025
      const orderDate = new Date(2025, 0, 27, 12, 0, 0);
      const shippingInfo = new ShippingInfo(
        orderDate,
        null,
        { minDays: 1, maxDays: 5 },
        { minDays: 5, maxDays: 15 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      const rangeString = shippingInfo.getArrivalDateRangeString();

      // Range should span from late January into February
      expect(rangeString).toMatch(/January.*February|February/);
    });

    it('should handle date ranges spanning across years', () => {
      // Monday, December 22, 2025
      const orderDate = new Date(2025, 11, 22, 12, 0, 0);
      const shippingInfo = new ShippingInfo(
        orderDate,
        null,
        { minDays: 2, maxDays: 5 },
        { minDays: 5, maxDays: 10 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      const rangeString = shippingInfo.getArrivalDateRangeString('short');

      // Range should span from late December 2025 into January 2026
      // Earliest: Dec 22 + 7 business days, Latest: Dec 22 + 15 business days
      expect(rangeString).toMatch(/Dec.*Jan/);
    });
  });

  describe('getMinProcessingDays', () => {
    it('should return minimum processing days', () => {
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        null,
        { minDays: 2, maxDays: 4 },
        { minDays: 7, maxDays: 16 },
        'US',
        'US',
        new Date('2025-12-12')
      );

      expect(shippingInfo.getMinProcessingDays()).toBe(2);
    });
  });

  describe('getMaxProcessingDays', () => {
    it('should return maximum processing days', () => {
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        null,
        { minDays: 2, maxDays: 4 },
        { minDays: 7, maxDays: 16 },
        'US',
        'US',
        new Date('2025-12-12')
      );

      expect(shippingInfo.getMaxProcessingDays()).toBe(4);
    });
  });

  describe('getMinDeliveryDays', () => {
    it('should return minimum delivery days', () => {
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        null,
        { minDays: 1, maxDays: 3 },
        { minDays: 5, maxDays: 10 },
        'CN',
        'UK',
        new Date('2025-12-12')
      );

      expect(shippingInfo.getMinDeliveryDays()).toBe(5);
    });
  });

  describe('getMaxDeliveryDays', () => {
    it('should return maximum delivery days', () => {
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        null,
        { minDays: 1, maxDays: 3 },
        { minDays: 5, maxDays: 10 },
        'CN',
        'UK',
        new Date('2025-12-12')
      );

      expect(shippingInfo.getMaxDeliveryDays()).toBe(10);
    });
  });

  describe('getShippingOrigin', () => {
    it('should return US origin', () => {
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        null,
        { minDays: 1, maxDays: 3 },
        { minDays: 3, maxDays: 5 },
        'US',
        'US',
        new Date('2025-12-12')
      );

      expect(shippingInfo.getShippingOrigin()).toBe('US');
    });

    it('should return CN origin', () => {
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        null,
        { minDays: 1, maxDays: 3 },
        { minDays: 7, maxDays: 16 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      expect(shippingInfo.getShippingOrigin()).toBe('CN');
    });
  });

  describe('getShippingDestination', () => {
    it('should return shipping destination', () => {
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        null,
        { minDays: 1, maxDays: 3 },
        { minDays: 7, maxDays: 16 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      expect(shippingInfo.getShippingDestination()).toBe('US');
    });
  });

  describe('getHolidayOrderCutoff', () => {
    it('should return holiday order cutoff date', () => {
      const cutoffDate = new Date('2025-12-12T05:00:00.000Z');
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        null,
        { minDays: 1, maxDays: 3 },
        { minDays: 7, maxDays: 16 },
        'US',
        'US',
        cutoffDate
      );

      expect(shippingInfo.getHolidayOrderCutoff()).toBe(cutoffDate);
    });
  });

  describe('isBeforeHolidayOrderCutoff', () => {
    it('should return true when current date is before cutoff', () => {
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        null,
        { minDays: 1, maxDays: 3 },
        { minDays: 7, maxDays: 16 },
        'US',
        'US',
        new Date('2099-12-12') // Use far future date
      );

      expect(shippingInfo.isBeforeHolidayOrderCutoff()).toBe(true);
    });

    it('should return false when current date is after cutoff', () => {
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        null,
        { minDays: 1, maxDays: 3 },
        { minDays: 7, maxDays: 16 },
        'US',
        'US',
        new Date('2020-12-12') // Use past date
      );

      expect(shippingInfo.isBeforeHolidayOrderCutoff()).toBe(false);
    });

    it('should return false when current date equals cutoff', () => {
      const now = new Date();
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        null,
        { minDays: 1, maxDays: 3 },
        { minDays: 7, maxDays: 16 },
        'US',
        'US',
        now
      );

      expect(shippingInfo.isBeforeHolidayOrderCutoff()).toBe(false);
    });
  });

  describe('getShipsOutAndArrivesDisplayValues', () => {
    it('should return processing info as shipsOut for in-stock items', () => {
      const processingInfo = { minDays: 1, maxDays: 3 };
      const deliveryInfo = { minDays: 7, maxDays: 16 };
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        null,
        processingInfo,
        deliveryInfo,
        'US',
        'US',
        new Date('2025-12-12')
      );

      const result = shippingInfo.getShipsOutAndArrivesDisplayValues();
      expect(result.shipsOut).toEqual(processingInfo);
      expect(result.arrives).toEqual(deliveryInfo);
    });

    it('should return ship out date for pre-order items', () => {
      const preOrderShipOutDate = new Date('2025-02-01');
      const deliveryInfo = { minDays: 7, maxDays: 16 };
      const shippingInfo = new ShippingInfo(
        new Date('2025-01-15'),
        preOrderShipOutDate,
        { minDays: 1, maxDays: 3 },
        deliveryInfo,
        'CN',
        'US',
        new Date('2025-12-12')
      );

      const result = shippingInfo.getShipsOutAndArrivesDisplayValues();
      expect(result.shipsOut).toBeInstanceOf(Date);
      expect((result.shipsOut as Date).toISOString()).toBe('2025-02-01T00:00:00.000Z');
      expect(result.arrives).toEqual(deliveryInfo);
    });

    it('should return processing info as shipsOut when preOrderShipOutDate is before orderDate', () => {
      const processingInfo = { minDays: 1, maxDays: 3 };
      const deliveryInfo = { minDays: 7, maxDays: 16 };
      const shippingInfo = new ShippingInfo(
        new Date('2025-02-01'),  // orderDate
        new Date('2025-01-15'),  // preOrderShipOutDate (before orderDate)
        processingInfo,
        deliveryInfo,
        'CN',
        'US',
        new Date('2025-12-12')
      );

      const result = shippingInfo.getShipsOutAndArrivesDisplayValues();
      // Should use in-stock logic: return processing info, not ship out date
      expect(result.shipsOut).toEqual(processingInfo);
      expect(result.arrives).toEqual(deliveryInfo);
    });
  });

  describe('getByDateAndLocation', () => {
    const customDeliveryConfig: DeliveryConfig = {
      "US": {
        "US": { minDays: 3, maxDays: 5 },
        "WW": { minDays: 5, maxDays: 10 }
      },
      "CN": {
        "US": { minDays: 7, maxDays: 16 },
        "GB": { minDays: 5, maxDays: 8 },
        "WW": { minDays: 7, maxDays: 14 }
      }
    };

    const customProcessingConfig: ProcessingConfig = {
      "US": { minDays: 1, maxDays: 3 },
      "CN": { minDays: 1, maxDays: 3 }
    };

    const customHolidayConfig: HolidayOrderCutoffConfig = {
      "US": {
        "US": "2025-12-12T00:00:00-05:00",
        "WW": "2025-12-10T00:00:00-05:00"
      },
      "CN": {
        "US": "2025-12-03T00:00:00-05:00",
        "GB": "2025-12-05T00:00:00-05:00",
        "WW": "2025-12-03T00:00:00-05:00"
      }
    };

    describe('US destination without US inventory', () => {
      it('should use CN processing and delivery times', () => {
        const metafields = createVariantShippingMetafields(
          null,
          null,
          null,
          null,
          createMetafield('false'),
          null
        );

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'US',
          new Date('2025-01-15'),
          metafields,
          customDeliveryConfig,
          customProcessingConfig,
          customHolidayConfig
        );

        expect(shippingInfo.getShippingOrigin()).toBe('CN');
        expect(shippingInfo.getShippingDestination()).toBe('US');
        expect(shippingInfo.getMinProcessingDays()).toBe(1);
        expect(shippingInfo.getMaxProcessingDays()).toBe(3);
        expect(shippingInfo.getMinDeliveryDays()).toBe(7);
        expect(shippingInfo.getMaxDeliveryDays()).toBe(16);
      });
    });

    describe('US destination with US inventory', () => {
      it('should use US processing and US->US delivery times', () => {
        const metafields = createVariantShippingMetafields(
          null,
          null,
          null,
          null,
          createMetafield('true'),
          null
        );

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'US',
          new Date('2025-01-15'),
          metafields,
          customDeliveryConfig,
          customProcessingConfig,
          customHolidayConfig
        );

        expect(shippingInfo.getShippingOrigin()).toBe('US');
        expect(shippingInfo.getShippingDestination()).toBe('US');
        expect(shippingInfo.getMinProcessingDays()).toBe(1);
        expect(shippingInfo.getMaxProcessingDays()).toBe(3);
        // Now uses US->US delivery times instead of CN->US
        expect(shippingInfo.getMinDeliveryDays()).toBe(3);
        expect(shippingInfo.getMaxDeliveryDays()).toBe(5);
      });

      it('should use US origin when pre-order fulfills from US (even without isFulfillingFromUS)', () => {
        // Create a pre-order timeline that fulfills from US
        const preOrderUSTimeline = {
          id: 'gid://shopify/Metafield/123',
          namespace: 'custom',
          key: 'pre_order_us_timeline',
          type: 'list.metaobject_reference',
          value: null,
          reference: null,
          references: [
            {
              __typename: 'Metaobject' as const,
              id: 'gid://shopify/Metaobject/1',
              fields: [
                { key: 'orderCutoffDate', value: null },
                { key: 'estimatedShippingDate', value: '2025-03-01' }
              ]
            }
          ]
        };
        // Transition date in the past means the order is a pre-order
        const inStockToPreOrderUSTransitionDate = createMetafield('2025-01-01');

        const metafields = createVariantShippingMetafields(
          null,  // preOrderWWTimeline
          preOrderUSTimeline,  // preOrderUSTimeline
          null,  // inStockToPreOrderWWTransitionDate
          inStockToPreOrderUSTransitionDate,  // inStockToPreOrderUSTransitionDate
          createMetafield('false'),  // isFulfillingFromUS is false
          null
        );

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'US',
          new Date('2025-01-15'),
          metafields,
          customDeliveryConfig,
          customProcessingConfig,
          customHolidayConfig
        );

        // Pre-order timeline fulfills from US, so origin should be US
        expect(shippingInfo.getShippingOrigin()).toBe('US');
        expect(shippingInfo.isInStock()).toBe(false);
        // Should use US->US delivery times
        expect(shippingInfo.getMinDeliveryDays()).toBe(3);
        expect(shippingInfo.getMaxDeliveryDays()).toBe(5);
      });

      it('should treat US customers with isFulfillingFromUS=true as in-stock even if WW pre-order exists', () => {
        // This test documents the current behavior: when shipping to US and isFulfillingFromUS=true,
        // the PreOrderTimeline returns an empty timeline (in-stock), even if a WW pre-order timeline exists.
        // This is because US customers with available US inventory are served from US stock.
        const preOrderWWTimeline = {
          id: 'gid://shopify/Metafield/456',
          namespace: 'custom',
          key: 'pre_order_ww_timeline',
          type: 'list.metaobject_reference',
          value: null,
          reference: null,
          references: [
            {
              __typename: 'Metaobject' as const,
              id: 'gid://shopify/Metaobject/2',
              fields: [
                { key: 'orderCutoffDate', value: null },
                { key: 'estimatedShippingDate', value: '2025-03-15' }
              ]
            }
          ]
        };
        const inStockToPreOrderWWTransitionDate = createMetafield('2025-01-01');

        const metafields = createVariantShippingMetafields(
          preOrderWWTimeline,  // preOrderWWTimeline exists
          null,  // preOrderUSTimeline
          inStockToPreOrderWWTransitionDate,  // inStockToPreOrderWWTransitionDate
          null,  // inStockToPreOrderUSTransitionDate
          createMetafield('true'),  // isFulfillingFromUS is TRUE - US inventory available
          null
        );

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'US',
          new Date('2025-01-15'),
          metafields,
          customDeliveryConfig,
          customProcessingConfig,
          customHolidayConfig
        );

        // Item is treated as in-stock (US inventory available), not as a pre-order
        expect(shippingInfo.isInStock()).toBe(true);
        // Origin is US because hasAvailableUSInventory is true and timeline is empty
        expect(shippingInfo.getShippingOrigin()).toBe('US');
        // Should use US->US delivery times
        expect(shippingInfo.getMinDeliveryDays()).toBe(3);
        expect(shippingInfo.getMaxDeliveryDays()).toBe(5);
      });
    });

    describe('GB destination', () => {
      it('should use CN processing and CN->GB delivery times', () => {
        const metafields = createVariantShippingMetafields(
          null,
          null,
          null,
          null,
          null,
          null
        );

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'GB',
          new Date('2025-01-15'),
          metafields,
          customDeliveryConfig,
          customProcessingConfig,
          customHolidayConfig
        );

        expect(shippingInfo.getShippingOrigin()).toBe('CN');
        expect(shippingInfo.getShippingDestination()).toBe('GB');
        expect(shippingInfo.getMinProcessingDays()).toBe(1);
        expect(shippingInfo.getMaxProcessingDays()).toBe(3);
        expect(shippingInfo.getMinDeliveryDays()).toBe(5);
        expect(shippingInfo.getMaxDeliveryDays()).toBe(8);
      });

      it('should use CN origin for GB pre-order items', () => {
        // Create a pre-order timeline for worldwide (which includes GB)
        const preOrderWWTimeline = {
          id: 'gid://shopify/Metafield/789',
          namespace: 'custom',
          key: 'pre_order_ww_timeline',
          type: 'list.metaobject_reference',
          value: null,
          reference: null,
          references: [
            {
              __typename: 'Metaobject' as const,
              id: 'gid://shopify/Metaobject/3',
              fields: [
                { key: 'orderCutoffDate', value: null },
                { key: 'estimatedShippingDate', value: '2025-03-20' }
              ]
            }
          ]
        };
        const inStockToPreOrderWWTransitionDate = createMetafield('2025-01-01');

        const metafields = createVariantShippingMetafields(
          preOrderWWTimeline,
          null,
          inStockToPreOrderWWTransitionDate,
          null,
          null,
          null
        );

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'GB',
          new Date('2025-01-15'),
          metafields,
          customDeliveryConfig,
          customProcessingConfig,
          customHolidayConfig
        );

        expect(shippingInfo.isInStock()).toBe(false);
        expect(shippingInfo.getShippingOrigin()).toBe('CN');
        expect(shippingInfo.getShippingDestination()).toBe('GB');
        expect(shippingInfo.getMinDeliveryDays()).toBe(5);
        expect(shippingInfo.getMaxDeliveryDays()).toBe(8);
      });
    });

    describe('WW destination', () => {
      it('should use CN processing and CN->WW delivery times', () => {
        const metafields = createVariantShippingMetafields(
          null,
          null,
          null,
          null,
          null,
          null
        );

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'CA',
          new Date('2025-01-15'),
          metafields,
          customDeliveryConfig,
          customProcessingConfig,
          customHolidayConfig
        );

        expect(shippingInfo.getShippingOrigin()).toBe('CN');
        expect(shippingInfo.getShippingDestination()).toBe('CA');
        expect(shippingInfo.getMinProcessingDays()).toBe(1);
        expect(shippingInfo.getMaxProcessingDays()).toBe(3);
        expect(shippingInfo.getMinDeliveryDays()).toBe(7);
        expect(shippingInfo.getMaxDeliveryDays()).toBe(14);
      });

      it('should use CN origin for WW pre-order items', () => {
        // Create a pre-order timeline for worldwide
        const preOrderWWTimeline = {
          id: 'gid://shopify/Metafield/101112',
          namespace: 'custom',
          key: 'pre_order_ww_timeline',
          type: 'list.metaobject_reference',
          value: null,
          reference: null,
          references: [
            {
              __typename: 'Metaobject' as const,
              id: 'gid://shopify/Metaobject/4',
              fields: [
                { key: 'orderCutoffDate', value: null },
                { key: 'estimatedShippingDate', value: '2025-04-01' }
              ]
            }
          ]
        };
        const inStockToPreOrderWWTransitionDate = createMetafield('2025-01-01');

        const metafields = createVariantShippingMetafields(
          preOrderWWTimeline,
          null,
          inStockToPreOrderWWTransitionDate,
          null,
          null,
          null
        );

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'AU',
          new Date('2025-01-15'),
          metafields,
          customDeliveryConfig,
          customProcessingConfig,
          customHolidayConfig
        );

        expect(shippingInfo.isInStock()).toBe(false);
        expect(shippingInfo.getShippingOrigin()).toBe('CN');
        expect(shippingInfo.getShippingDestination()).toBe('AU');
        expect(shippingInfo.getMinDeliveryDays()).toBe(7);
        expect(shippingInfo.getMaxDeliveryDays()).toBe(14);
      });
    });

    describe('with processing time override', () => {
      it('should use override processing times for US destination', () => {
        const metafields = createVariantShippingMetafields(
          null,
          null,
          null,
          null,
          createMetafield('true'),
          createMetafield('2-5 business days')
        );

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'US',
          new Date('2025-01-15'),
          metafields,
          customDeliveryConfig,
          customProcessingConfig,
          customHolidayConfig
        );

        expect(shippingInfo.getMinProcessingDays()).toBe(2);
        expect(shippingInfo.getMaxProcessingDays()).toBe(5);
      });

      it('should use override processing times for GB destination', () => {
        const metafields = createVariantShippingMetafields(
          null,
          null,
          null,
          null,
          null,
          createMetafield('3-7 business days')
        );

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'GB',
          new Date('2025-01-15'),
          metafields,
          customDeliveryConfig,
          customProcessingConfig,
          customHolidayConfig
        );

        expect(shippingInfo.getMinProcessingDays()).toBe(3);
        expect(shippingInfo.getMaxProcessingDays()).toBe(7);
      });

      it('should use override processing times for WW destination', () => {
        const metafields = createVariantShippingMetafields(
          null,
          null,
          null,
          null,
          null,
          createMetafield('1-4 business days')
        );

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'FR',
          new Date('2025-01-15'),
          metafields,
          customDeliveryConfig,
          customProcessingConfig,
          customHolidayConfig
        );

        expect(shippingInfo.getMinProcessingDays()).toBe(1);
        expect(shippingInfo.getMaxProcessingDays()).toBe(4);
      });
    });

    describe('with pre-order timeline', () => {
      it('should detect in-stock item', () => {
        const metafields = createVariantShippingMetafields(
          null,
          null,
          null,
          null,
          createMetafield('true'),
          null
        );

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'US',
          new Date('2025-01-15'),
          metafields,
          customDeliveryConfig,
          customProcessingConfig,
          customHolidayConfig
        );

        expect(shippingInfo.isInStock()).toBe(true);
      });
    });

    describe('holiday order cutoffs', () => {
      it('should use US holiday cutoff for US->US shipment', () => {
        const metafields = createVariantShippingMetafields(
          null,
          null,
          null,
          null,
          createMetafield('true'),
          null
        );

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'US',
          new Date('2025-01-15'),
          metafields,
          customDeliveryConfig,
          customProcessingConfig,
          customHolidayConfig
        );

        expect(shippingInfo.getHolidayOrderCutoff().toISOString()).toBe('2025-12-12T05:00:00.000Z');
      });

      it('should use CN holiday cutoff for CN->US shipment', () => {
        const metafields = createVariantShippingMetafields(
          null,
          null,
          null,
          null,
          createMetafield('false'),
          null
        );

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'US',
          new Date('2025-01-15'),
          metafields,
          customDeliveryConfig,
          customProcessingConfig,
          customHolidayConfig
        );

        expect(shippingInfo.getHolidayOrderCutoff().toISOString()).toBe('2025-12-03T05:00:00.000Z');
      });

      it('should use CN->GB holiday cutoff', () => {
        const metafields = createVariantShippingMetafields();

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'GB',
          new Date('2025-01-15'),
          metafields,
          customDeliveryConfig,
          customProcessingConfig,
          customHolidayConfig
        );

        expect(shippingInfo.getHolidayOrderCutoff().toISOString()).toBe('2025-12-05T05:00:00.000Z');
      });
    });
  });
});
