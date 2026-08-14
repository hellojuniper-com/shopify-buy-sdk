/**
 * A single line's promotion assignment: the variant, and the promotion (bundle) it was part of.
 */
export interface PromotionAssignment {
    /** Variant ID, as a GID or a legacy numeric ID. Normalized to legacy when encoded. */
    variantId: string | number;
    /** The promotion ID from the promotions service. */
    promotionId: string;
}

/**
 * The codec for promotion attribution carried from a storefront cart to a converted order.
 *
 * <p><b>Why this exists at all.</b> A Juniper storefront hands its cart to checkout through a
 * Shopify cart permalink (`/cart/{variantId}:{quantity},...`) so that Rebuy sees a real Liquid
 * cart. That permalink is rebuilt from variant IDs and quantities alone, so every line-item
 * custom attribute set on the Storefront cart is discarded crossing it, and Shopify's permalink
 * `properties` parameter cannot carry them back -- it applies to the first product only. A
 * cart-level `attributes[...]` parameter is the one channel that survives, and Shopify persists
 * those to the order as note attributes. So per-line data has to be flattened into one scalar
 * string, carried across, and expanded again on the other side.
 *
 * <p><b>Why the codec lives in this package.</b> The two halves run in different repositories:
 * juniper-react encodes when it builds the checkout URL, and the `shipping-timelines` checkout
 * extension in theme-enhanced-checkout decodes and writes the value back onto each cart line.
 * Two hand-written implementations of one wire format is how the two silently drift apart, so
 * the format has exactly one owner and one round-trip test suite.
 *
 * <p><b>Format.</b> `<legacyVariantId>:<promotionId>` pairs joined by commas:
 *
 * <pre>49955788095765:2026071401,49955788456213:2026071401</pre>
 *
 * <p><b>Everything here degrades rather than throws.</b> Encoding runs on the path to checkout
 * and decoding runs inside checkout. This is order attribution -- reporting, not order data --
 * so no malformed value may ever be the reason a customer cannot complete a purchase.
 */
export class PromotionAttribution {
    /**
     * The attribute key, used both as the cart attribute and as the line item attribute.
     *
     * <p>Deliberately the same key juniper-promo-commons stamps on draft order lines. Draft orders
     * are a separate checkout path, and downstream code should read one name whichever path
     * produced the order.
     */
    public static readonly ATTRIBUTE_KEY: string = "_promotion_id";

    private static readonly PAIR_SEPARATOR: string = ",";
    private static readonly FIELD_SEPARATOR: string = ":";

    /**
     * Ceiling on an encoded value, in characters.
     *
     * <p>The permalink already carries one `variantId:quantity` pair per line, so a large cart is
     * near the practical URL limit before attribution is appended. Overflowing the URL and
     * breaking checkout would be far worse than losing attribution on an unusually large cart, so
     * the value is truncated at a pair boundary rather than allowed to grow without bound.
     *
     * <p>Measured against the *percent-encoded* value, since that is what the URL carries. Every
     * `:` and `,` triples in length once encoded, so measuring the raw string would let roughly
     * 16% more through than this budget claims to allow.
     */
    public static readonly MAX_VALUE_LENGTH: number = 1000;

    /**
     * Encodes line assignments into the attribute value, or `""` when there is nothing to report.
     *
     * <p>Exact duplicate pairs are collapsed. A variant naming two different promotions is kept
     * twice: a variant whose units are split across two bundles is two lines, one promotion each.
     *
     * <p>A pair whose IDs would contain a separator is dropped rather than mangled. Neither ID has
     * ever contained one, but a single stray separator would silently re-shape every pair after it
     * for whoever parses this downstream.
     */
    public static encode(assignments: PromotionAssignment[]): string {
        if (!assignments || assignments.length === 0) {
            return "";
        }

        const pairs: string[] = [];
        assignments.forEach(function (assignment: PromotionAssignment) {
            if (!assignment) {
                return;
            }
            const variantId = PromotionAttribution.toLegacyId(assignment.variantId);
            // Trimmed here because `parse` trims: without this, `promotionId: "   "` encodes to a
            // pair that decodes to nothing, and padding would silently eat the length budget.
            const promotionId = assignment.promotionId ? String(assignment.promotionId).trim() : "";
            if (!variantId || !promotionId) {
                return;
            }
            if (PromotionAttribution.containsSeparator(variantId)
                || PromotionAttribution.containsSeparator(promotionId)) {
                return;
            }
            const pair = variantId + PromotionAttribution.FIELD_SEPARATOR + promotionId;
            if (pairs.indexOf(pair) < 0) {
                pairs.push(pair);
            }
        });

        return PromotionAttribution.joinWithinLimit(pairs);
    }

    /**
     * Parses an attribute value into a variant-to-promotion lookup, keyed by legacy variant ID.
     *
     * <p>Anything malformed is skipped without discarding the well-formed pairs around it.
     *
     * <p>The first pair for a variant wins. A variant can legitimately appear twice when its units
     * are split across two bundles, but a cart line carries a single merchandise ID, so there is
     * no way to honour both on the decoding side.
     */
    public static parse(attributeValue?: string | null): { [legacyVariantId: string]: string } {
        const attribution: { [legacyVariantId: string]: string } = {};
        if (!attributeValue) {
            return attribution;
        }

        attributeValue.split(PromotionAttribution.PAIR_SEPARATOR).forEach(function (pair: string) {
            const fields = pair.split(PromotionAttribution.FIELD_SEPARATOR);
            if (fields.length !== 2) {
                return;
            }
            const variantId = fields[0].trim();
            const promotionId = fields[1].trim();
            if (!variantId || !promotionId) {
                return;
            }
            // Own-property test, not `in`: `in` walks the prototype chain, so a malformed pair
            // keyed `constructor` or `toString` would read as already-present and be dropped.
            if (!Object.prototype.hasOwnProperty.call(attribution, variantId)) {
                attribution[variantId] = promotionId;
            }
        });

        return attribution;
    }

    /**
     * The promotion ID for a variant, or `null`.
     *
     * <p>Accepts a GID (`gid://shopify/ProductVariant/123`) or a legacy numeric ID, because a
     * checkout extension reads `merchandise.id` as a GID while the attribution is keyed the way
     * the cart permalink itself identifies variants.
     */
    public static getPromotionIdForVariant(
        variantId: string | number | undefined | null,
        attribution: { [legacyVariantId: string]: string },
    ): string | null {
        if (variantId === null || variantId === undefined || variantId === "" || !attribution) {
            return null;
        }
        const legacyId = PromotionAttribution.toLegacyId(variantId);
        // Guarded so an inherited member (`constructor`, `toString`) can never be returned as
        // though it were a promotion ID, which would break the `string | null` contract.
        if (!legacyId || !Object.prototype.hasOwnProperty.call(attribution, legacyId)) {
            return null;
        }
        return attribution[legacyId] || null;
    }

    /**
     * Builds the `attributes[...]=...` query parameter for a cart permalink, or `""`.
     *
     * <p>The key is emitted literally, matching Shopify's documented permalink examples
     * (`?attributes[from]=came-from-newsletter`); only the value is percent-encoded.
     */
    public static toPermalinkQueryParam(assignments: PromotionAssignment[]): string {
        const value = PromotionAttribution.encode(assignments);
        if (!value) {
            return "";
        }
        return "attributes[" + PromotionAttribution.ATTRIBUTE_KEY + "]=" + encodeURIComponent(value);
    }

    /**
     * The legacy numeric ID for a variant, or `""` when the input is not one.
     *
     * <p>Accepts a GID or a bare numeric ID and nothing else. The pattern is anchored on purpose:
     * an unanchored "trailing run of digits" match will happily manufacture a plausible-looking ID
     * out of anything — `'12,34'` becomes `34`, `'abc123'` becomes `123`, `-5` becomes `5` — and a
     * fabricated ID is worse than no ID, because it silently attributes a promotion to the wrong
     * variant. It also swallowed the separator before {@link #containsSeparator} could see it,
     * which left that guard dead for variant IDs.
     *
     * <p>Returning `""` lets the caller's existing emptiness check drop the pair.
     */
    private static toLegacyId(id: string | number): string {
        if (id === null || id === undefined) {
            return "";
        }
        const asString = String(id).trim();
        const match = /^(?:gid:\/\/shopify\/[A-Za-z]+\/)?(\d+)$/.exec(asString);
        return match ? match[1] : "";
    }

    private static containsSeparator(token: string): boolean {
        return token.indexOf(PromotionAttribution.PAIR_SEPARATOR) >= 0
            || token.indexOf(PromotionAttribution.FIELD_SEPARATOR) >= 0;
    }

    private static joinWithinLimit(pairs: string[]): string {
        let value = "";
        for (let index = 0; index < pairs.length; index++) {
            const candidate = value
                ? value + PromotionAttribution.PAIR_SEPARATOR + pairs[index]
                : pairs[index];
            if (encodeURIComponent(candidate).length > PromotionAttribution.MAX_VALUE_LENGTH) {
                break;
            }
            value = candidate;
        }
        return value;
    }
}

export default PromotionAttribution;
