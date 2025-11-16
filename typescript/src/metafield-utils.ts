import { Metafield, MetafieldReference, MetafieldReferenceMetaobject, MetaobjectField } from "../shared/types";

/**
 * Type guard to check if a MetafieldReference is a MetafieldReferenceMetaobject
 */
export const isMetafieldReferenceMetaobject = (
  ref: MetafieldReference
): ref is MetafieldReferenceMetaobject => {
  return 'fields' in ref;
};

/**
 * Validates a date string and returns a Date object
 * @param dateStr - Date string to validate
 * @param fieldName - Name of the field for error messages
 * @returns Valid Date object
 * @throws Error if date is invalid
 */
export const validateDate = (dateStr: string | null, fieldName: string): Date | null => {
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
export const getFieldValue = (fields: MetaobjectField[], key: string): string | null => {
    return fields.find(field => field.key === key)?.value ?? null;
};

/**
 * Extracts a boolean value from a metafield
 * @param metafield - Metafield to extract value from
 * @returns Boolean value
 */
export const getBooleanValue = (metafield: Metafield | null): boolean => {
  if (!metafield || metafield.value === null) {
    return false;
  }
  return metafield.value.toLowerCase() === 'true';
};
