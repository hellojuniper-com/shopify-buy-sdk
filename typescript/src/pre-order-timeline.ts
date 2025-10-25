import type {
  Metafield,
  MetaobjectField,
  MetafieldReferenceMetaobject,
  MetafieldReference
} from '../shared/types';

/**
 * Type guard to check if a MetafieldReference is a MetafieldReferenceMetaobject
 */
const isMetafieldReferenceMetaobject = (
  ref: MetafieldReference
): ref is MetafieldReferenceMetaobject => {
  return 'fields' in ref;
};

export interface VariantPreOrderMetafields {
  preOrderWWTimeline: Metafield | null;
  preOrderUSTimeline: Metafield | null;
  inStockToPreOrderWWTransitionDate: Metafield | null;
  inStockToPreOrderUSTransitionDate: Metafield | null;
}

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

/**
 * Validates a date string and returns a Date object
 * @param dateStr - Date string to validate
 * @param fieldName - Name of the field for error messages
 * @returns Valid Date object
 * @throws Error if date is invalid
 */
const validateDate = (dateStr: string | null, fieldName: string): Date | null => {
  if (dateStr === null) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}: ${dateStr}`);
  }
  return date;
};

/**
 * Extracts a field value by key from metaobject fields
 * @param fields - Array of metaobject fields
 * @param key - Field key to search for
 * @returns Field value or null if not found
 */
const getValueFromPreOrderBatch = (fields: MetaobjectField[], key: string): string | null =>
  fields.find(field => field.key === key)?.value ?? null;

/**
 * Parses metaobject fields into a validated PreOrderBatch
 * @param fields - Array of metaobject fields
 * @returns PreOrderBatch object with validated dates
 * @throws Error if required fields are missing or dates are invalid
 */
const parsePreOrderBatch = (fields: MetaobjectField[]): PreOrderBatch => {

  const orderCutoffDateStr = getValueFromPreOrderBatch(fields, 'orderCutoffDate');
  const estimatedShippingDateStr = getValueFromPreOrderBatch(fields, 'estimatedShippingDate');

  if (!estimatedShippingDateStr) {
    throw new Error('Each batch must have an estimatedShippingDate');
  }

  return {
    orderCutoffDate: validateDate(orderCutoffDateStr, 'orderCutoffDate'),
    estimatedShippingDate: validateDate(estimatedShippingDateStr, 'estimatedShippingDate')!,
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
   * Finds the pre-order timeline for a specific date and shipping location.
   * @param shipsTo - The location to which the order is being shipped.
   * @param orderDate - The date the order was placed.
   * @param variantPreOrderMetafields - The metafields associated with the variant.
   * @returns The pre-order timeline for the specified date and location.
   */
  static getByDateAndLocation(
    shipsTo: string,
    orderDate: Date,
    variantPreOrderMetafields: VariantPreOrderMetafields,
  ): PreOrderTimeline {
    try {
      const {
        preOrderWWTimeline,
        preOrderUSTimeline,
        inStockToPreOrderWWTransitionDate,
        inStockToPreOrderUSTransitionDate,
      } = variantPreOrderMetafields;

      let preOrderTimeline: Metafield | undefined | null;
      let inStockToPreOrderTransitionDate: Metafield | undefined | null;

      // 1a. Customer is not in the US, or product does not have US fulfillment.
      if (shipsTo !== 'US' || !preOrderUSTimeline) {
        preOrderTimeline = preOrderWWTimeline;
        inStockToPreOrderTransitionDate = inStockToPreOrderWWTransitionDate;
      }
      // 1b. Customer is in the US and product has US fulfillment.
      else {
        preOrderTimeline = preOrderUSTimeline;
        inStockToPreOrderTransitionDate = inStockToPreOrderUSTransitionDate;
      }

      // 2. There is no pre-order timeline for the product, so return empty timeline.
      if (!preOrderTimeline) {
        return PreOrderTimeline.fromMetaobjectList(null);
      }

      // 3. The order was made while the variant was in-stock, so return empty timeline.
      if (inStockToPreOrderTransitionDate?.value && orderDate < new Date(inStockToPreOrderTransitionDate.value)) {
        return PreOrderTimeline.fromMetaobjectList(null);
      }

      // 4. Parse, validate, deduplicate, and sort using the PreOrderTimeline factory.
      return PreOrderTimeline.fromMetaobjectList(preOrderTimeline, orderDate);
    } catch (error) {
      console.error('Error creating pre-order timeline:', error);
      return PreOrderTimeline.fromMetaobjectList(null);
    }
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
          return parsePreOrderBatch(metaobject.fields);
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
   * Formats a date to a readable format using Early/Mid/Late month
   * @returns Formatted date (e.g., "Early January", "Mid March", "Late December")
   */
  getFormattedShippingDate(): string | null {
    const date: Date | null = this.getEstimatedShippingDate();
    if (!date) {
      return null;
    }

    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'long' });

    // Determine Early (1-10), Mid (11-20), or Late (21-31)
    let period: string;
    if (day <= 10) {
      period = 'Early';
    } else if (day <= 20) {
      period = 'Mid';
    } else {
      period = 'Late';
    }

    return `${period} ${month}`;
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
  validateDate,
  getFieldValue: getValueFromPreOrderBatch,
  parseMetaobjectFields: parsePreOrderBatch,
  deduplicateOpenEndedBatches,
  sortBatchesByOrderCutoffDate,
};

export default PreOrderTimeline;
