import DefaultDeliveryTimes from "../config/delivery-times.json";
import DefaultProcessingTimes from "../config/processing-times.json";
import DefaultHolidayOrderCutoffs from "../config/holiday-order-cutoffs.json";
import { DayRange, DeliveryConfig, ProcessingConfig, HolidayOrderCutoffConfig } from "../shared/types";

export const getProcessingByLocation = (
    origin: string,
    processingConfig: ProcessingConfig = DefaultProcessingTimes,
): DayRange => {
    if (origin in processingConfig) {
        return processingConfig[origin as keyof ProcessingConfig];
    }
    return processingConfig['US'];
};

export const getDeliveryByLocation = (
    origin: string,
    destination: string,
    deliveryConfig: DeliveryConfig = DefaultDeliveryTimes,
): DayRange => {
    if (origin in deliveryConfig) {
        const destConfig = deliveryConfig[origin as keyof DeliveryConfig];
        if (destination in destConfig) {
            return destConfig[destination as keyof typeof destConfig];
        }
        return destConfig['WW'];
    }
    return deliveryConfig['CN']['WW'];
};

export const getHolidayOrderCuttoffByLocation = (
    origin: string,
    destination: string,
    holidayOrderCutoffConfig: HolidayOrderCutoffConfig = DefaultHolidayOrderCutoffs,
): Date => {
    if (origin in holidayOrderCutoffConfig) {
        const destConfig = holidayOrderCutoffConfig[origin as keyof HolidayOrderCutoffConfig];
        if (destination in destConfig) {
            return new Date(destConfig[destination as keyof typeof destConfig]);
        }
        return new Date(destConfig['WW']);
    }
    return new Date(holidayOrderCutoffConfig['CN']['WW']);
}
