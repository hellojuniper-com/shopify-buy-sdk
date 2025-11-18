import { DayRange, DeliveryConfig, ProcessingConfig, ShipsOutAndArrivesDisplayValues, VariantShippingMetafields } from "../shared/types";
import { convertToDayRange, getBooleanValue } from "./metafield-utils";
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

    public getShipsOutAndArrivesDisplayValues(): ShipsOutAndArrivesDisplayValues {
        const shipsOut = this.isInStock() ? this.processingInfo : this.getShipOutDate();
        const arrives = this.deliveryInfo;
        return { shipsOut, arrives };
    }

    public static getByDateAndLocation(
        shipsTo: string,
        orderDate: Date,
        variantShippingMetafields: VariantShippingMetafields,
        deliveryConfig: DeliveryConfig = DefaultDeliveryTimes,
        processingConfig: ProcessingConfig = DefaultProcessingTimes,
    ): ShippingInfo {
        let deliveryTimes: DayRange;
        let processingTimes: DayRange;

        const hasAvailableUSInventory = getBooleanValue(variantShippingMetafields.isFulfillingFromUS);
        const processingTimeOverride = convertToDayRange(variantShippingMetafields.processingTimeString?.value);

        switch(shipsTo) {
            case 'US':
                deliveryTimes = getDeliveryByLocation('CN', 'US', deliveryConfig);
                processingTimes = processingTimeOverride
                    ? processingTimeOverride
                    : getProcessingByLocation(hasAvailableUSInventory ? 'US' : 'CN', processingConfig);
                break;
            case 'UK':
                deliveryTimes = getDeliveryByLocation('CN', 'UK', deliveryConfig);
                processingTimes = processingTimeOverride
                    ? processingTimeOverride
                    : getProcessingByLocation('CN', processingConfig);
                break;
            default:
                deliveryTimes = getDeliveryByLocation('CN', 'WW', deliveryConfig);
                processingTimes = processingTimeOverride
                    ? processingTimeOverride
                    : getProcessingByLocation('CN', processingConfig);
                break;
        }

        const preOrderTimeline = PreOrderTimeline.getByDateAndLocation(shipsTo, orderDate, variantShippingMetafields);
        const preOrderShipOutDate = preOrderTimeline.getEstimatedShippingDate();

        return new ShippingInfo(orderDate, preOrderShipOutDate, processingTimes, deliveryTimes);
    }
}
