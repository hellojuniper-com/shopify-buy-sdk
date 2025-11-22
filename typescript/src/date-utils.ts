import { DateRange, DayRange } from "../shared/types";

/**
 * Adds business days to a date, skipping weekends (Saturday and Sunday)
 * @param startDate - The starting date
 * @param businessDays - Number of business days to add
 * @returns A new Date with the business days added
 */
export function addBusinessDays(startDate: Date, businessDays: number): Date {
    const result = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < businessDays) {
        result.setDate(result.getDate() + 1);
        const dayOfWeek = result.getDay();
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            daysAdded++;
        }
    }

    return result;
}

/**
 * Converts a day range string to an object with minDays and maxDays
 * @param dayRangeStr - Day range string (e.g. "1-3 business days" or similar)
 * @returns DayRange object or null if input is invalid
 */
export const convertToDayRange = (dayRangeStr: string | null | undefined): DayRange | null => {
    if (!dayRangeStr) {
        return null;
    }

    // Match patterns like "1 - 3 business days", "1–3 business days", "1-2 business days".
    // Handles regular hyphen, en-dash (–), and em-dash (—) with optional spaces.
    const rangeMatch = dayRangeStr.match(/(\d+)\s*[-–—]\s*(\d+)/);

    if (!rangeMatch) {
        return null;
    }

    return {
        minDays: parseInt(rangeMatch[1], 10),
        maxDays: parseInt(rangeMatch[2], 10),
    };
};

/**
 * Formats a date range as a human-readable string
 * @param dateRange - The date range with earliest and latest dates
 * @param monthFormat - Whether to use full month names ("long") or abbreviated ("short")
 * @returns Formatted string:
 *   - Same month: "February 2 – 14" (long) or "Feb 2 – 14" (short)
 *   - Different months: "Feb 14 – Mar 1" (always uses short format)
 */
export const toDateRangeString = (dateRange: DateRange, monthFormat: "long" | "short" = "long"): string => {
    const { earliest, latest } = dateRange;
    const sameMonth = earliest.getMonth() === latest.getMonth() && earliest.getFullYear() === latest.getFullYear();

    if (sameMonth) {
        const month = earliest.toLocaleDateString("en-US", { month: monthFormat });
        return `${month} ${earliest.getDate()} – ${latest.getDate()}`;
    }

    // Different months: always use short format for readability
    const earliestMonth = earliest.toLocaleDateString("en-US", { month: "short" });
    const latestMonth = latest.toLocaleDateString("en-US", { month: "short" });
    return `${earliestMonth} ${earliest.getDate()} – ${latestMonth} ${latest.getDate()}`;
};
