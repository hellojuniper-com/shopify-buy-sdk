/**
 * Shared type definitions used across the Shopify Buy SDK
 * These types are re-exported in index.d.ts for external consumers
 */

/**
 * https://shopify.dev/docs/api/storefront/2025-01/objects/MediaImage
 */
export interface MediaImage {
  id: string;
  mediaContentType: string;
  image?: Image;
}

/**
 * https://shopify.dev/docs/api/storefront/2025-01/objects/Video
*/
export interface Video {
  id: string;
  mediaContentType: string;
  previewImage?: {
    url: string;
  }
  sources: {
    height: number,
    width: number,
    url: string;
    format: string;
  }[];
}

/**
 * https://shopify.dev/docs/api/storefront/2025-01/objects/GenericFile
 */
export interface MetafieldReferenceGenericFile {
  id: string;
  mimeType?: string;
  url?: string;
}

/**
 * https://shopify.dev/docs/api/storefront/2025-01/objects/Metaobject
 */
export interface MetafieldReferenceMetaobject {
  id: string;
  fields: Array<MetaobjectField>;
}

/**
 * https://shopify.dev/docs/api/storefront/2025-01/unions/MetafieldReference
 */
export type MetafieldReference =
    MediaImage |
    Video |
    MetafieldReferenceGenericFile |
    MetafieldReferenceMetaobject;

/**
 * https://shopify.dev/docs/api/storefront/2025-01/objects/MetaobjectField
 */
export interface MetaobjectField {
  key: string;
  type: string;
  value: string | null;
  reference: MetafieldReference | null;
}

export interface Metafield extends MetaobjectField {
  id: string;
  namespace: string;
  reference: MetafieldReference | null;
  references?: Array<MetafieldReference> | null;
}

/**
 * Internal Image description
 */
export interface Image {
  id: string | number;
  height: number;
  width: number;
  src: string;
  altText: string;
}

export interface VariantShippingMetafields {
  preOrderWWTimeline: Metafield | null;
  preOrderUSTimeline: Metafield | null;
  inStockToPreOrderWWTransitionDate: Metafield | null;
  inStockToPreOrderUSTransitionDate: Metafield | null;
  isFulfillingFromUS: Metafield | null;
  processingTimeString: Metafield | null;
}

export type DayRange = { minDays: number; maxDays: number; };

export type DateRange = { earliest: Date; latest: Date; };

export type DeliveryConfig = {
  "US": {
    "US": DayRange;
    "WW": DayRange;
  },
  "CN": {
    "US": DayRange;
    "GB": DayRange;
    "WW": DayRange;
  },
};

export type ProcessingConfig = {
  "US": DayRange;
  "CN": DayRange;
};

export type HolidayOrderCutoffConfig = {
  "US": {
    "US": string;
    "WW": string;
  },
  "CN": {
    "US": string;
    "GB": string;
    "WW": string;
  },
};

export type ShipsOutAndArrivesDisplayValues = {
  shipsOut: Date | DayRange;
  arrives: DayRange;
};
