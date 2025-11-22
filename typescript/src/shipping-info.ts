import {
    DateRange,
    DayRange,
    DeliveryConfig,
    HolidayOrderCutoffConfig,
    ProcessingConfig,
    ShipsOutAndArrivesDisplayValues,
    VariantShippingMetafields,
} from "../shared/types";
import { getBooleanValue } from "./metafield-utils";
import { addBusinessDays, convertToDayRange, toDateRangeString } from "./date-utils";
import PreOrderTimeline from "./pre-order-timeline";
import DefaultDeliveryTimes from "../config/delivery-times.json";
import DefaultProcessingTimes from "../config/processing-times.json";
import DefaultHolidayOrderCutoffs from "../config/holiday-order-cutoffs.json";
import { getDeliveryByLocation, getHolidayOrderCuttoffByLocation, getProcessingByLocation } from "./config-utils";

export class ShippingInfo {
    private readonly orderDate: Date;
    private readonly preOrderShipOutDate: Date | null;
    private readonly processingInfo: { minDays: number; maxDays: number };
    private readonly deliveryInfo: { minDays: number; maxDays: number };
    private readonly shippingOrigin: 'US' | 'CN';
    private readonly shippingDestination: string;
    private readonly holidayOrderCutoff: Date;

    public constructor(
        orderDate: Date,
        preOrderShipOutDate: Date | null,
        processingInfo: { minDays: number; maxDays: number },
        deliveryInfo: { minDays: number; maxDays: number },
        shippingOrigin: 'US' | 'CN',
        shippingDestination: string,
        holidayOrderCutoff: Date,
    ) {
        this.orderDate = orderDate;
        this.preOrderShipOutDate = preOrderShipOutDate;
        this.processingInfo = processingInfo;
        this.deliveryInfo = deliveryInfo;
        this.shippingOrigin = shippingOrigin;
        this.shippingDestination = shippingDestination;
        this.holidayOrderCutoff = holidayOrderCutoff;
    }

    public isInStock(): boolean {
        return (this.preOrderShipOutDate === null);
    }

    public getShipOutDate(): Date {
        const inStockShipOutDate = addBusinessDays(this.orderDate, this.processingInfo.maxDays);
        return this.preOrderShipOutDate ? new Date(this.preOrderShipOutDate) : inStockShipOutDate;
    }

    public getArrivalDate(): Date {
        const { latest } = this.getArrivalDateRange();
        return latest;
    }

    public getArrivalDateRange(): DateRange {
        let minDays: number, maxDays: number;
        let startDate: Date;

        if (this.isInStock()) {
            startDate = new Date(this.orderDate);
            minDays = this.processingInfo.minDays + this.deliveryInfo.minDays;
            maxDays = this.processingInfo.maxDays + this.deliveryInfo.maxDays;
        } else {
            startDate = this.getShipOutDate();
            minDays = this.deliveryInfo.minDays;
            maxDays = this.deliveryInfo.maxDays;
        }
        
        return {
            earliest: addBusinessDays(startDate, minDays),
            latest: addBusinessDays(startDate, maxDays),
        };
    }

    public getArrivalDateRangeString(monthFormat: "long" | "short" = "long"): string {
        return toDateRangeString(this.getArrivalDateRange(), monthFormat);
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

    public getShippingOrigin(): 'US' | 'CN' {
        return this.shippingOrigin;
    }

    public getShippingDestination(): string {
        return this.shippingDestination;
    }

    public getHolidayOrderCutoff(): Date {
        return this.holidayOrderCutoff;
    }

    public isBeforeHolidayOrderCutoff(): boolean {
        return new Date() < this.getHolidayOrderCutoff();
    }

    public getShipsOutAndArrivesDisplayValues(): ShipsOutAndArrivesDisplayValues {
        const shipsOut = this.isInStock() ? this.processingInfo : this.getShipOutDate();
        const arrives = this.deliveryInfo;
        return { shipsOut, arrives };
    }

    public static getByDateAndLocation(
        shippingDestination: string,
        orderDate: Date,
        variantShippingMetafields: VariantShippingMetafields,
        deliveryConfig: DeliveryConfig = DefaultDeliveryTimes,
        processingConfig: ProcessingConfig = DefaultProcessingTimes,
        holidayOrderCutoffConfig: HolidayOrderCutoffConfig = DefaultHolidayOrderCutoffs,
    ): ShippingInfo {
        let deliveryTimes: DayRange;
        let processingTimes: DayRange;


        const preOrderTimeline = PreOrderTimeline.getByDateAndLocation(
            shippingDestination,
            orderDate,
            variantShippingMetafields,
        );

        const hasAvailableUSInventory = getBooleanValue(variantShippingMetafields.isFulfillingFromUS);
        const processingTimeOverride = convertToDayRange(variantShippingMetafields.processingTimeString?.value);
        // For pre-orders, the timeline's fulfillment location is the source of truth.
        // For in-stock items (empty timeline), use hasAvailableUSInventory to determine origin.
        const shippingOrigin = preOrderTimeline.isEmpty()
            ? (hasAvailableUSInventory ? 'US' : 'CN')
            : preOrderTimeline.getFulfillmentLocation();

        switch(shippingDestination) {
            case 'US':
                deliveryTimes = getDeliveryByLocation(shippingOrigin, shippingDestination, deliveryConfig);
                processingTimes = processingTimeOverride
                    ? processingTimeOverride
                    : getProcessingByLocation(shippingOrigin, processingConfig);
                break;
            case 'GB':
                deliveryTimes = getDeliveryByLocation('CN', shippingDestination, deliveryConfig);
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

        const preOrderShipOutDate = preOrderTimeline.getEstimatedShippingDate();
        const holidayOrderCutoff = getHolidayOrderCuttoffByLocation(
            shippingOrigin,
            shippingDestination,
            holidayOrderCutoffConfig,
        );

        return new ShippingInfo(
            orderDate,
            preOrderShipOutDate,
            processingTimes,
            deliveryTimes,
            shippingOrigin,
            shippingDestination,
            holidayOrderCutoff,
        );
    }
}
