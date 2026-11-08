/**
 * Shopify "dynamic tax-inclusive pricing" (part of Shopify Markets) is driven by the
 * `@inContext(country:, language:)` directive on Storefront API *read* operations. When a
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

/**
 * Builds the argument list for the `@inContext` directive, e.g. `country: GB, language: EN`.
 * Values are emitted as GraphQL enum literals (unquoted), matching `CountryCode`/`LanguageCode`.
 *
 * @private
 * @param {Object} context
 * @param {String} [context.country] A Shopify `CountryCode` enum value (e.g. `GB`).
 * @param {String} [context.language] A Shopify `LanguageCode` enum value (e.g. `EN`).
 * @return {String} The directive arguments, or `''` when neither is set.
 */
function inContextArgs({country, language} = {}) {
  const args = [];

  if (country) {
    args.push(`country: ${country}`);
  }

  if (language) {
    args.push(`language: ${language}`);
  }

  return args.join(', ');
}

/**
 * Injects an `@inContext(...)` directive into the leading `query` operation of a serialized
 * GraphQL document. Returns the document unchanged when there is no context to apply, when
 * the directive is already present, or when the operation is not a `query` (e.g. a mutation).
 *
 * The operation header is matched up to its selection-set `{`, anchored to the start of a
 * top-level definition (string start, or the `,` that graphql-js-client emits between
 * definitions — it serializes referenced fragments first and the operation last) so that a
 * field named `query` inside a selection set cannot match. Only the operation is rewritten;
 * the fragment definitions are left alone.
 *
 * @param {String} query The serialized GraphQL document.
 * @param {Object} [context]
 * @param {String} [context.country] A Shopify `CountryCode` enum value (e.g. `GB`).
 * @param {String} [context.language] A Shopify `LanguageCode` enum value (e.g. `EN`).
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
