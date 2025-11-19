import {
  Metafield,
  MetaobjectField,
  MetafieldReferenceMetaobject,
  MetafieldReference,
  VariantShippingMetafields
} from '../shared/types';
import { getFieldValue, getBooleanValue, isMetafieldReferenceMetaobject, validateDate } from './metafield-utils';

/**
 * Represents a single pre-order batch
 */
export interface PreOrderBatch {
  /**
   * The cutoff date for orders to be included in this batch. If null, then
   * the pre-order batch is currently available for orders to be placed under.
   */
  orderCutoffDate: Date | null;

  /**
   * The estimated date that the pre-order will begin to ship to customers.
   */
  estimatedShippingDate: Date;
}

interface FormatedShippingDateOptions {
  month?: 'long' | 'short';
  capitalize?: boolean;
}

/**
 * Parses metaobject fields into a validated PreOrderBatch
 * @param fields - Array of metaobject fields
 * @returns PreOrderBatch object with validated dates
 * @throws Error if required fields are missing or dates are invalid
 */
const parseMetaobjectFieldList = (fields: MetaobjectField[]): PreOrderBatch => {

  const orderCutoffDateStr = getFieldValue(fields, 'orderCutoffDate');
  const estimatedShippingDateStr = getFieldValue(fields, 'estimatedShippingDate');

  if (!estimatedShippingDateStr) {
    throw new Error('Each batch must have an estimatedShippingDate');
  }

  const orderCutoffDate = validateDate(orderCutoffDateStr, 'orderCutoffDate');
  const estimatedShippingDate = validateDate(estimatedShippingDateStr, 'estimatedShippingDate');

  if (!estimatedShippingDate) {
    throw new Error('estimatedShippingDate cannot be null');
  }

  return {
    orderCutoffDate,
    estimatedShippingDate,
  };
};

/**
 * Deduplicates open-ended batches (null orderCutoffDate) by keeping only the one with the latest estimatedShippingDate
 * @param batches - Array of batch objects
 * @returns New array with at most one open-ended batch (the one with latest shipping date)
 * @note If multiple open-ended batches have the same estimatedShippingDate, the first one encountered is kept
 */
const deduplicateOpenEndedBatches = (batches: PreOrderBatch[]): PreOrderBatch[] => {
  const openEndedBatches = batches.filter(batch => batch.orderCutoffDate === null);
  const closedBatches = batches.filter(batch => batch.orderCutoffDate !== null);

  // If there's 0 or 1 open-ended batch, no deduplication needed
  if (openEndedBatches.length <= 1) {
    return [...batches];  // Return new array for immutability
  }

  // Keep only the open-ended batch with the latest estimatedShippingDate
  const latestOpenEndedBatch = openEndedBatches.reduce((latest, current) =>
    current.estimatedShippingDate.getTime() > latest.estimatedShippingDate.getTime()
      ? current
      : latest
  );

  return [...closedBatches, latestOpenEndedBatch];
};

/**
 * Sorts batches by orderCutoffDate (nulls last)
 * @param batches - Array of batch objects
 * @returns New sorted array with closed batches first (oldest to newest), open-ended batches last
 * @note Uses stable sort - batches with equal cutoff dates maintain their relative order
 */
const sortBatchesByOrderCutoffDate = (batches: PreOrderBatch[]): PreOrderBatch[] =>
  [...batches].sort((a, b) => {
    // Null cutoff dates should come last (current/final batch)
    if (a.orderCutoffDate === null) return 1;
    if (b.orderCutoffDate === null) return -1;

    // Sort by date (oldest first)
    return a.orderCutoffDate.getTime() - b.orderCutoffDate.getTime();
  });

/**
 * Encapsulates pre-order timeline data with parsing, validation, and query methods
 */
export class PreOrderTimeline {
  private readonly batches: PreOrderBatch[];
  private readonly orderDate: Date;

  /**
   * Private constructor - use static factory method fromMetaobjectList instead
   * @param batches - Validated and sorted array of pre-order batches
   * @param orderDate - The order date for context (defaults to now)
   */
  private constructor(batches: PreOrderBatch[], orderDate: Date = new Date()) {
    this.batches = batches;
    this.orderDate = orderDate;
  }

  /**
   * Helper method to find estimated shipping date from specific metafields.
   * Implements the logic from the "Find Estimated Shipping Date" flowchart.
   * @param preOrderTimeline - The pre-order timeline metafield
   * @param inStockToPreOrderTransitionDate - The transition date metafield
   * @param orderDate - The date the order was placed
   * @returns PreOrderTimeline instance if valid, null otherwise
   */
  private static getByDateAndLocationInternal(
    preOrderTimeline: Metafield | null | undefined,
    inStockToPreOrderTransitionDate: Metafield | null | undefined,
    orderDate: Date
  ): PreOrderTimeline | null {
    try {
      // 1. Does variant have a Pre-Order Timeline?
      if (!preOrderTimeline) {
        // The variant is only available while in-stock, and therefore will never become a pre-order.
        return null;
      }

      // 2. Does variant have a Pre-Order Transition Date?
      if (!inStockToPreOrderTransitionDate?.value) {
        // The variant is currently in stock, and therefore does not have a pre-order timeline.
        return null;
      }

      // 3. Is Order Date before Pre-Order Transition Date?
      //    Note that orders placed exactly on the transition date are considered pre-orders.
      if (orderDate < new Date(inStockToPreOrderTransitionDate.value)) {
        // The variant is still in-stock at the time of order, so no pre-order timeline applies.
        return null;
      }

      // 4. Convert the metafield into a PreOrderTimeline instance, then check for applicable pre-order batch.
      const timeline: PreOrderTimeline = PreOrderTimeline.fromMetaobjectList(preOrderTimeline, orderDate);
      if (timeline.getBatchForOrderDate() === null) {
        // No applicable pre-order batch found for the order date.
        return null;
      }

      // 5. An applicable pre-order batch was found, so return the PreOrderTimeline instance.
      return timeline;
    } catch (error) {
      console.error('Error creating pre-order timeline:', error);
      return null;
    }
  }

  /**
   * Finds the pre-order timeline for a specific date and shipping location.
   * @param shipsTo - The location (ISO 3166 two-letter country code) to which the order is being shipped.
   *                  If the country code is invalid, we just assume that the location is outside the US.
   * @param orderDate - The date the order was placed.
   * @param variantPreOrderMetafields - The metafields associated with the variant.
   * @returns The pre-order timeline for the specified date and location.
   */
  static getByDateAndLocation(
    shipsTo: string,
    orderDate: Date,
    variantPreOrderMetafields: VariantShippingMetafields,
  ): PreOrderTimeline {
    const {
      preOrderWWTimeline,
      preOrderUSTimeline,
      inStockToPreOrderWWTransitionDate,
      inStockToPreOrderUSTransitionDate,
      isFulfillingFromUS,
    } = variantPreOrderMetafields;

    // 1. US customers: Try US metafields first.
    if (shipsTo === 'US') {
      const usTimeline: PreOrderTimeline | null = this.getByDateAndLocationInternal(
        preOrderUSTimeline,
        inStockToPreOrderUSTransitionDate,
        orderDate
      );

      // 1a. If a US timeline is found, return it.
      if (usTimeline) {
        return usTimeline;
      }

      // 1b. If no US timeline is found but there is currently US inventory, return an empty
      //     timeline, since an estimated shipping date does not exist since the item is in stock.
      if (getBooleanValue(isFulfillingFromUS)) {
        return PreOrderTimeline.fromMetaobjectList(null);
      }
    }

    // 2. International customers OR US customers with no valid US timeline: Use Int'l metafields
    const wwTimeline: PreOrderTimeline | null = this.getByDateAndLocationInternal(
      preOrderWWTimeline,
      inStockToPreOrderWWTransitionDate,
      orderDate
    );

    // 2a. If an Int'l timeline is found, return it; otherwise, return an empty timeline.
    return wwTimeline ?? PreOrderTimeline.fromMetaobjectList(null);
  }

  /**
   * Creates a PreOrderTimeline instance from a MetaobjectList
   * @param metaobjectList - Raw metaobject list from Shopify
   * @param orderDate - The order date for context (defaults to now)
   * @returns PreOrderTimeline instance with parsed, validated, and sorted batches
   * @note Invalid batches are filtered out and logged; processing continues with valid batches
   */
  static fromMetaobjectList(metaobjectList: Metafield | null | undefined, orderDate: Date = new Date()): PreOrderTimeline {
    // 0. Handle null/undefined or missing references
    if (!metaobjectList || !metaobjectList.references) {
      return new PreOrderTimeline([], orderDate);
    }

    // 1. Parse all batches from metaobject edges, filtering out invalid ones
    const parsedBatches = metaobjectList.references
      .filter(isMetafieldReferenceMetaobject)
      .map((metaobject, index) => {
        try {
          return parseMetaobjectFieldList(metaobject.fields);
        } catch (error) {
          console.error(`Error parsing batch at index ${index}:`, error);
          return null;
        }
      })
      .filter((batch): batch is PreOrderBatch => batch !== null);

    // 2. If no valid batches, return empty timeline
    if (parsedBatches.length === 0) {
      return new PreOrderTimeline([], orderDate);
    }

    // 3. Apply functional pipeline: deduplicate and sort
    const processedBatches = sortBatchesByOrderCutoffDate(
      deduplicateOpenEndedBatches(parsedBatches)
    );

    // 4. Return new PreOrderTimeline instance
    return new PreOrderTimeline(processedBatches, orderDate);
  }

  /**
   * Gets the applicable batch for a given order date
   * @returns The applicable batch or null if none found
   */
  getBatchForOrderDate(): PreOrderBatch | null {
    return this.batches.find(batch =>
      batch.orderCutoffDate === null || this.orderDate <= batch.orderCutoffDate
    ) ?? null;
  }

  /**
   * Gets the estimated shipping date for the current order
   * @returns The estimated shipping date or null if not found
   */
  getEstimatedShippingDate(): Date | null {
    const batch = this.getBatchForOrderDate();
    return batch ? batch.estimatedShippingDate : null;
  }

  /**
   * Formats a date to a readable format using early/mid/late month
   * @returns Formatted date (e.g., "early January", "mid March", "late December")
   */
  getFormattedShippingDate({
    month = 'long',
    capitalize = false,
  }: FormatedShippingDateOptions = {}): string | null {
    const date: Date | null = this.getEstimatedShippingDate();
    if (!date) {
      return null;
    }

    const day = date.getDate();
    const monthStr = date.toLocaleDateString('en-US', { month });

    // Determine Early (1-10), Mid (11-20), or Late (21-31)
    let period: string;
    if (day <= 10) {
      period = 'Early';
    } else if (day <= 20) {
      period = 'Mid';
    } else {
      period = 'Late';
    }

    return `${capitalize ? period : period.toLowerCase()} ${monthStr}`;
  }

  /**
   * Returns all batches in the timeline
   * @returns Array of pre-order batches
   */
  getBatches(): PreOrderBatch[] {
    return [...this.batches];
  }

  /**
   * Checks if the timeline is empty
   * @returns True if no batches exist
   */
  isEmpty(): boolean {
    return this.batches.length === 0;
  }

  /**
   * Gets the order date used for context
   * @returns The order date
   */
  getOrderDate(): Date {
    return this.orderDate;
  }

  /**
   * Checks if the estimated shipping date has passed
   * @param currentDate - The current date to compare against (defaults to now)
   * @returns True if the shipping date has passed
   */
  hasEstimatedShippingDatePassed(currentDate: Date = new Date()): boolean {
    const estimatedShippingDate = this.getEstimatedShippingDate();
    if (!estimatedShippingDate) {
      return false;
    }
    return currentDate >= estimatedShippingDate;
  }
}

// Export private functions for testing
export const __testing__ = {
  parseMetaobjectFieldList,
  deduplicateOpenEndedBatches,
  sortBatchesByOrderCutoffDate,
};

export default PreOrderTimeline;
