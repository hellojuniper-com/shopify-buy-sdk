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
  });

  describe('getShipOutDate', () => {
    it('should return orderDate + minProcessingDays for in-stock items', () => {
      const orderDate = new Date('2025-01-15');
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
      expect(shipOutDate.toISOString()).toBe('2025-01-18T00:00:00.000Z');
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
  });

  describe('getArrivalDate', () => {
    it('should return shipOutDate + maxDeliveryDays for in-stock items', () => {
      const orderDate = new Date('2025-01-15');
      const shippingInfo = new ShippingInfo(
        orderDate,
        null,
        { minDays: 1, maxDays: 3 },
        { minDays: 7, maxDays: 16 },
        'CN',
        'US',
        new Date('2025-12-12')
      );

      const arrivalDate = shippingInfo.getArrivalDate();
      // Order date (2025-01-15) + minProcessingDays (1) + maxDeliveryDays (16) = 2025-02-01
      expect(arrivalDate.toISOString()).toBe('2025-02-01T00:00:00.000Z');
    });

    it('should return preOrderShipOutDate + maxDeliveryDays for pre-order items', () => {
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

      const arrivalDate = shippingInfo.getArrivalDate();
      // Pre-order ship out (2025-02-01) + maxDeliveryDays (16) = 2025-02-17
      expect(arrivalDate.toISOString()).toBe('2025-02-17T00:00:00.000Z');
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
  });

  describe('getByDateAndLocation', () => {
    const customDeliveryConfig: DeliveryConfig = {
      "US": { "US": { minDays: 3, maxDays: 5 } },
      "CN": {
        "US": { minDays: 7, maxDays: 16 },
        "UK": { minDays: 5, maxDays: 8 },
        "WW": { minDays: 7, maxDays: 14 }
      }
    };

    const customProcessingConfig: ProcessingConfig = {
      "US": { minDays: 1, maxDays: 3 },
      "CN": { minDays: 1, maxDays: 3 }
    };

    const customHolidayConfig: HolidayOrderCutoffConfig = {
      "US": { "US": "2025-12-12T00:00:00-05:00" },
      "CN": {
        "US": "2025-12-03T00:00:00-05:00",
        "UK": "2025-12-05T00:00:00-05:00",
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
      it('should use US processing and CN->US delivery times', () => {
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
        expect(shippingInfo.getMinDeliveryDays()).toBe(7);
        expect(shippingInfo.getMaxDeliveryDays()).toBe(16);
      });
    });

    describe('UK destination', () => {
      it('should use CN processing and CN->UK delivery times', () => {
        const metafields = createVariantShippingMetafields(
          null,
          null,
          null,
          null,
          null,
          null
        );

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'UK',
          new Date('2025-01-15'),
          metafields,
          customDeliveryConfig,
          customProcessingConfig,
          customHolidayConfig
        );

        expect(shippingInfo.getShippingOrigin()).toBe('CN');
        expect(shippingInfo.getShippingDestination()).toBe('UK');
        expect(shippingInfo.getMinProcessingDays()).toBe(1);
        expect(shippingInfo.getMaxProcessingDays()).toBe(3);
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

      it('should use override processing times for UK destination', () => {
        const metafields = createVariantShippingMetafields(
          null,
          null,
          null,
          null,
          null,
          createMetafield('3-7 business days')
        );

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'UK',
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

      it('should use CN->UK holiday cutoff', () => {
        const metafields = createVariantShippingMetafields();

        const shippingInfo = ShippingInfo.getByDateAndLocation(
          'UK',
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
