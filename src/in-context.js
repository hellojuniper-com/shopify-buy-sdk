/**
 * Shopify "dynamic tax-inclusive pricing" (part of Shopify Markets) is driven by the
 * `@inContext(country:)` directive on Storefront API *read* operations. When a
 * query carries it, the Storefront API returns prices already converted via the market's
 * Dynamic FX and **tax-inclusive** for markets that enable dynamic tax-inclusive display —
 * so the displayed price matches what the customer pays at checkout.
 *
 * This SDK compiles its `.graphql` documents with graphql-js-client, whose document builder
 * cannot express an operation-level directive: `graphql-js-client-compiler` silently drops
 * `@inContext`, and `Operation#toString` has no slot for a directive (and the instance is
 * frozen). Rather than fork those vendored classes, we inject the directive into the
 * already-serialized query string at the fetcher boundary (see `./client`).
 *
 * This is safe because graphql-js-client decodes responses from the *Operation object*, not
 * from the query string — adding a directive changes neither the selection set nor response
 * shape, so decoding and pagination are unaffected.
 *
 * Only `query` operations are rewritten. Mutations are left untouched: cart and checkout
 * price context is carried instead by `buyerIdentity.countryCode`, which the cart input
 * mapper already supports on cart create.
 */

import {isCountryCode} from './country-code';

function inContextArgs({country} = {}) {
  return isCountryCode(country) ? `country: ${country}` : '';
}

/**
 * Injects an `@inContext(...)` directive into the `query` operation of a serialized
 * GraphQL document. Returns the document unchanged when there is no context to apply, when
 * the directive is already present, or when the operation is not a `query` (e.g. a mutation).
 *
 * graphql-js-client serializes fragments first and comma-joins definitions, so the operation
 * keyword follows the string start or a `,`. That skips `query:` arguments and `$query`
 * variables; it relies on no document selecting a field or alias named `query`.
 *
 * @param {String} query The serialized GraphQL document.
 * @param {Object} [context]
 * @param {String} [context.country] A Shopify `CountryCode` enum value (e.g. `GB`).
 * @return {String} The document with the directive injected, or the original document.
 */
export default function injectInContext(query, context = {}) {
  const args = inContextArgs(context);

  if (!args || typeof query !== 'string' || query.indexOf('@inContext') !== -1) {
    return query;
  }

  return query.replace(
    /(^|,)(\s*)query\b([^{}]*?)\{/,
    (match, boundary, whitespace, header) => {
      const trimmedHeader = header.replace(/\s+$/, '');

      return `${boundary}${whitespace}query${trimmedHeader} @inContext(${args}) {`;
    }
  );
}

export {inContextArgs};
