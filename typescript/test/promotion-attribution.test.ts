import { describe, it, expect } from '@jest/globals';
import { PromotionAttribution, PromotionAssignment } from '../src/promotion-attribution';

const toVariantGid = (legacyId: string) => `gid://shopify/ProductVariant/${legacyId}`;

/**
 * The four keychain variants and the zero-discount bundle from order #GT13256, the order this
 * format was first verified against end to end.
 */
const KEYCHAIN_VARIANT_IDS = ['49955788095765', '49955788456213', '49955787702549', '50048923336981'];
const KEYCHAIN_PROMOTION_ID = '2026071401';

const keychainAssignments: PromotionAssignment[] = KEYCHAIN_VARIANT_IDS.map((variantId) => ({
    variantId: toVariantGid(variantId),
    promotionId: KEYCHAIN_PROMOTION_ID,
}));

const KEYCHAIN_ENCODED = KEYCHAIN_VARIANT_IDS
    .map((variantId) => `${variantId}:${KEYCHAIN_PROMOTION_ID}`)
    .join(',');

describe('PromotionAttribution.encode', () => {
    it('encodes assignments as legacy-variant-to-promotion pairs', () => {
        expect(PromotionAttribution.encode(keychainAssignments)).toEqual(KEYCHAIN_ENCODED);
    });

    it('accepts legacy IDs as readily as GIDs', () => {
        expect(PromotionAttribution.encode([{ variantId: '44123', promotionId: 'promo-a' }]))
            .toEqual('44123:promo-a');
        expect(PromotionAttribution.encode([{ variantId: 44123, promotionId: 'promo-a' }]))
            .toEqual('44123:promo-a');
    });

    it('is empty when there is nothing to report', () => {
        expect(PromotionAttribution.encode([])).toEqual('');
    });

    it('collapses exact duplicate pairs', () => {
        expect(PromotionAttribution.encode([
            { variantId: '44123', promotionId: 'promo-a' },
            { variantId: '44123', promotionId: 'promo-a' },
        ])).toEqual('44123:promo-a');
    });

    /**
     * A variant whose units are split across two bundles is two lines, one promotion each. Both
     * assignments have to survive encoding, even though decoding can only honour the first.
     */
    it('keeps a variant that appears under two different promotions', () => {
        expect(PromotionAttribution.encode([
            { variantId: '44123', promotionId: 'promo-a' },
            { variantId: '44123', promotionId: 'promo-b' },
        ])).toEqual('44123:promo-a,44123:promo-b');
    });

    it('skips assignments missing either ID', () => {
        expect(PromotionAttribution.encode([
            { variantId: '', promotionId: 'promo-a' },
            { variantId: '44123', promotionId: '' },
            { variantId: '44124', promotionId: 'promo-b' },
        ])).toEqual('44124:promo-b');
    });

    /**
     * A stray separator inside an ID would silently re-shape every pair after it downstream, so
     * the offending pair is dropped rather than corrupting the payload.
     */
    it('drops a pair whose promotion ID contains a separator', () => {
        expect(PromotionAttribution.encode([
            { variantId: '44123', promotionId: 'promo,a' },
            { variantId: '44124', promotionId: 'promo:b' },
            { variantId: '44125', promotionId: 'promo-c' },
        ])).toEqual('44125:promo-c');
    });

    /**
     * The permalink already carries a pair per line and sits near the practical URL limit. Losing
     * attribution on an outsized cart is recoverable; a broken checkout is not.
     */
    it('truncates at a pair boundary rather than growing without bound', () => {
        const assignments: PromotionAssignment[] = [];
        for (let index = 0; index < 200; index++) {
            assignments.push({ variantId: `4995578809${index}`, promotionId: `2026071401${index}` });
        }

        const encoded = PromotionAttribution.encode(assignments);

        expect(encoded.length).toBeLessThanOrEqual(PromotionAttribution.MAX_VALUE_LENGTH);
        expect(encoded).not.toEqual('');
        encoded.split(',').forEach((pair) => {
            expect(pair).toMatch(/^\d+:\d+$/);
        });
    });
});

describe('PromotionAttribution.parse', () => {
    it('parses the value emitted for a complete zero-discount bundle', () => {
        expect(PromotionAttribution.parse(KEYCHAIN_ENCODED)).toEqual({
            '49955788095765': '2026071401',
            '49955788456213': '2026071401',
            '49955787702549': '2026071401',
            '50048923336981': '2026071401',
        });
    });

    it('is empty for a cart with no promotion', () => {
        expect(PromotionAttribution.parse(undefined)).toEqual({});
        expect(PromotionAttribution.parse(null)).toEqual({});
        expect(PromotionAttribution.parse('')).toEqual({});
    });

    it('keeps the first pair when a variant appears under two promotions', () => {
        expect(PromotionAttribution.parse('44123:promo-a,44123:promo-b'))
            .toEqual({ '44123': 'promo-a' });
    });

    /**
     * Decoding runs inside checkout. A malformed value must degrade to "no attribution" and never
     * throw -- the order-level attribute is on the order regardless.
     */
    it('skips malformed pairs without discarding the good ones', () => {
        const value = 'nonsense,44123:promo-a,:promo-b,44124:,44125:promo-c:extra,44126:promo-d';

        expect(PromotionAttribution.parse(value)).toEqual({
            '44123': 'promo-a',
            '44126': 'promo-d',
        });
    });

    it('tolerates whitespace around the fields', () => {
        expect(PromotionAttribution.parse(' 44123 : promo-a ')).toEqual({ '44123': 'promo-a' });
    });
});

/**
 * The reason the codec lives in this package rather than being hand-written on both sides. The
 * encoder runs in juniper-react and the decoder runs in a checkout extension in a different
 * repository; nothing else would catch the two drifting apart.
 */
describe('PromotionAttribution round trip', () => {
    it('recovers every assignment it encoded', () => {
        const attribution = PromotionAttribution.parse(PromotionAttribution.encode(keychainAssignments));

        KEYCHAIN_VARIANT_IDS.forEach((variantId) => {
            expect(attribution[variantId]).toEqual(KEYCHAIN_PROMOTION_ID);
        });
    });

    it('recovers assignments through the permalink query parameter', () => {
        const param = PromotionAttribution.toPermalinkQueryParam(keychainAssignments);
        const encodedValue = param.substring(param.indexOf('=') + 1);

        expect(PromotionAttribution.parse(decodeURIComponent(encodedValue)))
            .toEqual(PromotionAttribution.parse(KEYCHAIN_ENCODED));
    });

    it('resolves a GID straight back to the promotion it was encoded with', () => {
        const attribution = PromotionAttribution.parse(PromotionAttribution.encode(keychainAssignments));

        expect(PromotionAttribution.getPromotionIdForVariant(toVariantGid(KEYCHAIN_VARIANT_IDS[0]), attribution))
            .toEqual(KEYCHAIN_PROMOTION_ID);
    });
});

describe('PromotionAttribution.getPromotionIdForVariant', () => {
    const attribution = { '49955788095765': '2026071401' };

    it('matches a GID against the legacy IDs in the attribution', () => {
        expect(PromotionAttribution.getPromotionIdForVariant(toVariantGid('49955788095765'), attribution))
            .toEqual('2026071401');
    });

    it('matches a legacy ID directly', () => {
        expect(PromotionAttribution.getPromotionIdForVariant('49955788095765', attribution))
            .toEqual('2026071401');
    });

    it('returns null for a line that was not part of a bundle', () => {
        expect(PromotionAttribution.getPromotionIdForVariant(toVariantGid('11111111'), attribution))
            .toBeNull();
    });

    it('returns null when there is no variant', () => {
        expect(PromotionAttribution.getPromotionIdForVariant(undefined, attribution)).toBeNull();
        expect(PromotionAttribution.getPromotionIdForVariant(null, attribution)).toBeNull();
    });
});

describe('PromotionAttribution.toPermalinkQueryParam', () => {
    it('percent-encodes the value but leaves the documented bracket syntax literal', () => {
        const param = PromotionAttribution.toPermalinkQueryParam([
            { variantId: '44123', promotionId: '2026071401' },
        ]);

        expect(param).toEqual('attributes[_promotion_id]=44123%3A2026071401');
    });

    it('is empty when there is nothing to report', () => {
        expect(PromotionAttribution.toPermalinkQueryParam([])).toEqual('');
    });
});

describe('PromotionAttribution.ATTRIBUTE_KEY', () => {
    /**
     * Must stay identical to the key juniper-promo-commons stamps on draft order lines, so
     * downstream reads one key whichever checkout path produced the order.
     */
    it('is the key the draft order path also uses', () => {
        expect(PromotionAttribution.ATTRIBUTE_KEY).toEqual('_promotion_id');
    });
});
