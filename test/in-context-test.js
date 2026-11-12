import assert from 'assert';
import injectInContext, {inContextArgs} from '../src/in-context';

suite('in-context-test', () => {
  test('it builds directive args for country only', () => {
    assert.equal(inContextArgs({country: 'GB'}), 'country: GB');
  });

  test('it returns empty args when no context is provided', () => {
    assert.equal(inContextArgs(), '');
    assert.equal(inContextArgs({}), '');
  });

  test('it injects @inContext into an anonymous query with variable definitions', () => {
    const query = 'query ($id: ID!) {node(id: $id) {id}}';

    assert.equal(
      injectInContext(query, {country: 'GB'}),
      'query ($id: ID!) @inContext(country: GB) {node(id: $id) {id}}'
    );
  });

  test('it injects @inContext into a named query', () => {
    const query = 'query ProductById ($id: ID!) {node(id: $id) {id}}';

    assert.equal(
      injectInContext(query, {country: 'DE'}),
      'query ProductById ($id: ID!) @inContext(country: DE) {node(id: $id) {id}}'
    );
  });

  test('it injects @inContext into a query with no variable definitions', () => {
    const query = 'query {shop {name}}';

    assert.equal(
      injectInContext(query, {country: 'GB'}),
      'query @inContext(country: GB) {shop {name}}'
    );
  });

  test('it targets the operation when fragments are serialized first (real document shape)', () => {
    // graphql-js-client joins definitions with commas and emits referenced fragments *first*, with
    // the operation last — e.g. `fragment A on T {..},query ($id: ID!) {..}`. The operation is
    // therefore preceded by `},` rather than whitespace, and a fragment field such as
    // `metafields(identifiers: []) {` produces its own `) {`, so the directive must anchor to the
    // operation keyword, not the first `) {` in the document.
    const query =
      'fragment ProductFragment on Product {metafields(identifiers: []) {id}},' +
      'query ($id: ID!) {node(id: $id) {...ProductFragment}}';

    const result = injectInContext(query, {country: 'GB'});

    assert.equal(
      result,
      'fragment ProductFragment on Product {metafields(identifiers: []) {id}},' +
      'query ($id: ID!) @inContext(country: GB) {node(id: $id) {...ProductFragment}}'
    );
    // The directive appears exactly once, on the operation.
    assert.equal(result.match(/@inContext/g).length, 1);
  });

  test('it injects when the operation is the only definition (no fragments)', () => {
    const query = 'query ($id: ID!) {node(id: $id) {id}}';

    assert.equal(
      injectInContext(query, {country: 'GB'}),
      'query ($id: ID!) @inContext(country: GB) {node(id: $id) {id}}'
    );
  });

  test('it skips a query argument that precedes the operation in a fragment', () => {
    const fragment = 'fragment F on QueryRoot  { id,products (first: 1 query: "x") { edges { node { id } } } }';

    assert.equal(
      injectInContext(`${fragment},query  { ...F }`, {country: 'GB'}),
      `${fragment},query @inContext(country: GB) { ...F }`
    );
  });

  test('it leaves a mutation with a $query variable untouched', () => {
    const mutation = 'mutation ($a:Int,$query:String)  { foo (a: $a query: $query) { id } }';

    assert.equal(injectInContext(mutation, {country: 'GB'}), mutation);
  });

  test('it leaves mutations untouched', () => {
    const mutation = 'mutation ($input: CartInput!) {cartCreate(input: $input) {cart {id}}}';

    assert.equal(injectInContext(mutation, {country: 'GB'}), mutation);
  });

  test('it leaves mutations untouched even when fragments precede them', () => {
    const mutation =
      'fragment CartFragment on Cart {id},' +
      'mutation ($input: CartInput!) {cartCreate(input: $input) {cart {...CartFragment}}}';

    assert.equal(injectInContext(mutation, {country: 'GB'}), mutation);
  });

  test('it returns the query unchanged when no context is configured', () => {
    const query = 'query ($id: ID!) {node(id: $id) {id}}';

    assert.equal(injectInContext(query, {}), query);
    assert.equal(injectInContext(query), query);
  });

  test('it does not double-inject when a directive is already present', () => {
    const query = 'query ($id: ID!) @inContext(country: GB) {node(id: $id) {id}}';

    assert.equal(injectInContext(query, {country: 'GB'}), query);
  });

  test('it leaves the query unchanged for a country outside the Shopify CountryCode enum', () => {
    const query = 'query ($id: ID!) {node(id: $id) {id}}';

    ['gb', 'GBR', 'G', 'G1', 'GB, language: EN', '', 'UK', 'PR', ['GB']].forEach((country) => {
      assert.equal(injectInContext(query, {country}), query, `country '${country}'`);
    });
  });

  test('it is a no-op for non-string input', () => {
    let notSet;

    assert.equal(injectInContext(notSet, {country: 'GB'}), notSet);
    assert.equal(injectInContext(null, {country: 'GB'}), null);
  });
});
