import { DeliveryConfig, ProcessingConfig, VariantShippingMetafields } from "../shared/types";
import { getBooleanValue, getFieldValue } from "./metafield-utils";
import PreOrderTimeline from "./pre-order-timeline";
import DefaultDeliveryTimes from "../config/delivery-times.json";
import DefaultProcessingTimes from "../config/processing-times.json";
import { getDeliveryByLocation, getProcessingByLocation } from "./config-utils";

export class ShippingInfo {
    private readonly orderDate: Date;
    private readonly preOrderShipOutDate: Date | null;
    private readonly processingInfo: { minDays: number; maxDays: number };
    private readonly deliveryInfo: { minDays: number; maxDays: number };

    public constructor(
        orderDate: Date,
        preOrderShipOutDate: Date | null,
        processingInfo: { minDays: number; maxDays: number },
        deliveryInfo: { minDays: number; maxDays: number },
    ) {
        this.orderDate = orderDate;
        this.preOrderShipOutDate = preOrderShipOutDate;
        this.processingInfo = processingInfo;
        this.deliveryInfo = deliveryInfo;
    }

    public isInStock(): boolean {
        return (this.preOrderShipOutDate === null);
    }

    public getShipOutDate(): Date {
        const inStockShipOutDate = new Date(this.orderDate);
        inStockShipOutDate.setDate(this.orderDate.getDate() + this.processingInfo.minDays);
        return this.preOrderShipOutDate ? this.preOrderShipOutDate : inStockShipOutDate;
    }

    public getArrivalDate(): Date {
        const arrivalDate = this.getShipOutDate();
        arrivalDate.setDate(arrivalDate.getDate() + this.deliveryInfo.maxDays);
        return arrivalDate;
    }

    public getMinProcessingDays(): number {
        return this.processingInfo.minDays;
    }

    public getMaxProcessingDays(): number {
        return this.processingInfo.maxDays;
    }

    public getMinDeliveryDays(): number {
        return this.deliveryInfo.minDays;
    }

    public getMaxDeliveryDays(): number {
        return this.deliveryInfo.maxDays;
    }

    public static getByDateAndLocation(
        shipsTo: string,
        orderDate: Date,
        variantShippingMetafields: VariantShippingMetafields,
        deliveryConfig: DeliveryConfig = DefaultDeliveryTimes,
        processingConfig: ProcessingConfig = DefaultProcessingTimes,
    ): ShippingInfo {
        let deliveryTimes: { minDays: number; maxDays: number };
        let processingTimes: { minDays: number; maxDays: number };
        let shipOutDate: Date | null = null;

        const hasAvailableUSInventory = getBooleanValue(variantShippingMetafields.isFulfillingFromUS);

        switch(shipsTo) {
            case 'US':
                deliveryTimes = getDeliveryByLocation('CN', 'US', deliveryConfig);
                processingTimes = getProcessingByLocation(hasAvailableUSInventory ? 'US' : 'CN', processingConfig);
                break;
            case 'UK':
                deliveryTimes = getDeliveryByLocation('CN', 'UK', deliveryConfig);
                processingTimes = getProcessingByLocation('CN', processingConfig);
                break;
            default:
                deliveryTimes = getDeliveryByLocation('CN', 'WW', deliveryConfig);
                processingTimes = getProcessingByLocation('CN', processingConfig);
                break;
        }

        const preOrderTimeline = PreOrderTimeline.getByDateAndLocation(shipsTo, orderDate, variantShippingMetafields);
        
        const preOrderShipOutDate = preOrderTimeline.getEstimatedShippingDate();
        if (preOrderShipOutDate) {
            shipOutDate = preOrderShipOutDate;
        } else if (shipsTo === 'US' && hasAvailableUSInventory) {
            shipOutDate = new Date();
        }

        return new ShippingInfo(orderDate, shipOutDate, processingTimes, deliveryTimes);
    }
}
