import DefaultDeliveryTimes from "../config/delivery-times.json";
import DefaultProcessingTimes from "../config/processing-times.json";
import { DayRange, DeliveryConfig, ProcessingConfig } from "../shared/types";

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
    }
    return deliveryConfig['CN']['US'];
};
