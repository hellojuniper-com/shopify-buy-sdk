import {discountMapper, getDiscountAllocationId, getDiscountApplicationId} from './cart-discount-mapping';

export function getVariantType() {
  return {
    name: 'ProductVariant',
    kind: 'OBJECT',
    fieldBaseTypes: {
      availableForSale: 'Boolean',
      compareAtPrice: 'MoneyV2',
      id: 'ID',
      image: 'Image',
      price: 'MoneyV2',
      product: 'Product',
      selectedOptions: 'SelectedOption',
      sku: 'String',
      title: 'String',
      unitPrice: 'MoneyV2',
      unitPriceMeasurement: 'UnitPriceMeasurement',
      weight: 'Float'
    },
    implementsNode: true
  };
}

export function getLineItemType() {
  return {
    name: 'CheckoutLineItem',
    kind: 'OBJECT',
    fieldBaseTypes: {
      customAttributes: 'Attribute',
      discountAllocations: 'Object[]',
      id: 'ID',
      quantity: 'Int',
      title: 'String',
      variant: 'Merchandise'
    },
    implementsNode: true
  };
}

function getDiscountAllocationType() {
  return {
    fieldBaseTypes: {
      allocatedAmount: 'MoneyV2',
      discountApplication: 'DiscountApplication'
    },
    implementsNode: false,
    kind: 'OBJECT',
    name: 'DiscountAllocation'
  };
}

export function mapVariant(merchandise) {
  // Copy all properties except 'product'
  const result = {};

  for (const key in merchandise) {
    if (merchandise.hasOwnProperty(key) && key !== 'product') {
      result[key] = merchandise[key];
    }
  }

  // Add additional properties
  result.priceV2 = merchandise.price;
  result.compareAtPriceV2 = merchandise.compareAtPrice;
  result.product = merchandise.product;
  result.type = getVariantType();

  return result;
}

export function mapDiscountAllocations(discountAllocations, discountApplications) {
  if (!discountAllocations) { return []; }

  const result = [];

  for (let i = 0; i < discountAllocations.length; i++) {
    const allocation = discountAllocations[i];
    let application = null;

    for (let j = 0; j < discountApplications.length; j++) {
      if (getDiscountAllocationId(allocation) === getDiscountApplicationId(discountApplications[j])) {
        application = discountApplications[j];
        break;
      }
    }

    if (!application) {
      throw new Error(`Missing discount application for allocation: ${JSON.stringify(allocation)}`);
    }

    const discountApp = Object.assign({}, application);

    result.push({
      allocatedAmount: allocation.discountedAmount,
      discountApplication: discountApp,
      type: getDiscountAllocationType()
    });
  }

  return result;
}

export function mapLineItems(lines, discountApplications) {
  if (!lines || !Array.isArray(lines)) { return []; }

  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line || !line.merchandise || !line.merchandise.product) { continue; }

    const variant = mapVariant(line.merchandise);

    result.push({
      customAttributes: line.attributes,
      discountAllocations: mapDiscountAllocations(line.discountAllocations || [], discountApplications),
      id: line.id,
      quantity: line.quantity,
      title: line.merchandise.product.title,
      variant,
      hasNextPage: false,
      hasPreviousPage: false,
      variableValues: line.variableValues,
      type: getLineItemType()
    });
  }

  return result;
}

export function mapDiscountsAndLines(cart) {
  if (!cart) { return {discountApplications: [], cartLinesWithDiscounts: []}; }

  const result = discountMapper({
    cartLineItems: cart.lines || [],
    cartDiscountAllocations: cart.discountAllocations || [],
    cartDiscountCodes: cart.discountCodes || []
  });

  const mappedLines = mapLineItems(result.cartLinesWithAllDiscountAllocations || [], result.discountApplications || []);

  return {
    discountApplications: result.discountApplications || [],
    cartLinesWithDiscounts: mappedLines
  };
}
