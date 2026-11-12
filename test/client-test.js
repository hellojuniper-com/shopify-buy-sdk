import assert from 'assert';
import GraphQLJSClient from '../src/graphql-client';
import Config from '../src/config';
import Client from '../src/client';
import types from '../schema.json';
import {version} from '../package.json';
import shopInfoFixture from '../fixtures/shop-info-fixture';

suite('client-test', () => {
  const config = {
    domain: 'grapqhql.myshopify.com',
    storefrontAccessToken: '595005d0c565f6969eece280de85edb5',
    apiVersion: '2025-01'
  };

  test('it instantiates a GraphQL client with the given config', () => {
    let passedTypeBundle;
    let passedUrl;
    let passedFetcherOptions;

    class FakeGraphQLJSClient {
      constructor(typeBundle, {url, fetcherOptions}) {
        passedTypeBundle = typeBundle;
        passedUrl = url;
        passedFetcherOptions = fetcherOptions;
      }
    }

    new Client(new Config(config), FakeGraphQLJSClient); // eslint-disable-line no-new

    assert.deepEqual(passedTypeBundle, types);
    assert.equal(passedUrl.split('?')[0], `https://${config.domain}/api/${config.apiVersion}/graphql`);
    assert.deepEqual(passedFetcherOptions, {
      headers: {
        'Accept-Language': '*',
        'X-SDK-Variant': 'javascript',
        'X-SDK-Version': version,
        'X-Shopify-Storefront-Access-Token': config.storefrontAccessToken
      }
    });
  });

  test('it instantiates a GraphQL client with the given config and custom source header when source config is provided', () => {
    let passedTypeBundle;
    let passedUrl;
    let passedFetcherOptions;

    class FakeGraphQLJSClient {
      constructor(typeBundle, {url, fetcherOptions}) {
        passedTypeBundle = typeBundle;
        passedUrl = url;
        passedFetcherOptions = fetcherOptions;
      }
    }

    const withSourceConfig = Object.assign({}, config, {
      source: 'buy-button-js'
    });

    new Client(new Config(withSourceConfig), FakeGraphQLJSClient); // eslint-disable-line no-new

    assert.deepEqual(passedTypeBundle, types);
    assert.equal(passedUrl.split('?')[0], `https://${withSourceConfig.domain}/api/${withSourceConfig.apiVersion}/graphql`);
    assert.deepEqual(passedFetcherOptions, {
      headers: {
        'Accept-Language': '*',
        'X-SDK-Variant': 'javascript',
        'X-SDK-Version': version,
        'X-Shopify-Storefront-Access-Token': withSourceConfig.storefrontAccessToken,
        'X-SDK-Variant-Source': withSourceConfig.source
      }
    });
  });

  test('it instantiates a GraphQL client with the given config and language header when a language config is provided', () => {
    let passedTypeBundle;
    let passedUrl;
    let passedFetcherOptions;

    class FakeGraphQLJSClient {
      constructor(typeBundle, {url, fetcherOptions}) {
        passedTypeBundle = typeBundle;
        passedUrl = url;
        passedFetcherOptions = fetcherOptions;
      }
    }

    const withLanguageConfig = Object.assign({}, config, {
      language: 'ja-JP'
    });

    new Client(new Config(withLanguageConfig), FakeGraphQLJSClient); // eslint-disable-line no-new

    assert.deepEqual(passedTypeBundle, types);
    assert.equal(passedUrl.split('?')[0], `https://${withLanguageConfig.domain}/api/${withLanguageConfig.apiVersion}/graphql`);
    assert.deepEqual(passedFetcherOptions, {
      headers: {
        'X-SDK-Variant': 'javascript',
        'X-SDK-Version': version,
        'X-Shopify-Storefront-Access-Token': withLanguageConfig.storefrontAccessToken,
        'Accept-Language': withLanguageConfig.language
      }
    });
  });

  test('it creates a fetcher from the fetch function provided', () => {
    let passedFetcher;
    let passedUrl;
    let passedBody;
    let passedMethod;
    let passedMode;
    let passedHeaders;

    class FakeGraphQLJSClient {
      constructor(_, {fetcher}) {
        passedFetcher = fetcher;
      }
    }

    function fetchFunction(url, {body, method, mode, headers}) {
      passedUrl = url;
      passedBody = body;
      passedMethod = method;
      passedMode = mode;
      passedHeaders = headers;

      return Promise.resolve({json: () => {}}); // eslint-disable-line no-empty-function
    }

    new Client(new Config(config), FakeGraphQLJSClient, fetchFunction); // eslint-disable-line no-new

    return passedFetcher({data: 'body'}).then(() => {
      assert.equal(passedUrl.split('?')[0], `https://${config.domain}/api/${config.apiVersion}/graphql`);
      assert.equal(passedBody, JSON.stringify({data: 'body'}));
      assert.equal(passedMethod, 'POST');
      assert.equal(passedMode, 'cors');
      assert.deepEqual(passedHeaders, {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': '*',
        'X-SDK-Variant': 'javascript',
        'X-SDK-Version': version,
        'X-Shopify-Storefront-Access-Token': config.storefrontAccessToken
      });
    });
  });

  test('it creates an instance of the GraphQLJSClient by default', () => {
    const client = Client.buildClient(config);

    assert.ok(GraphQLJSClient.prototype.isPrototypeOf(client.graphQLClient));
  });

  test('it has static helpers', () => {
    const client = Client.buildClient(config);

    assert.ok(client.product.helpers);
    assert.ok(client.image.helpers);
  });

  suite('market context', () => {
    const originalWarn = console.warn; // eslint-disable-line no-console
    const originalFetch = global.fetch;
    let warnings;

    setup(() => {
      warnings = [];
      console.warn = (message) => warnings.push(message); // eslint-disable-line no-console
    });

    teardown(() => {
      console.warn = originalWarn; // eslint-disable-line no-console
      global.fetch = originalFetch;
    });

    function fetchShopQuery(extraConfig) {
      let query;

      function fetchFunction(url, {body}) {
        query = JSON.parse(body).query;

        return Promise.resolve({json: () => shopInfoFixture});
      }

      const client = new Client(new Config(Object.assign({}, config, extraConfig)), GraphQLJSClient, fetchFunction);

      return client.shop.fetchInfo().then(() => query);
    }

    test('it issues reads in the market context when a country config is provided', () => {
      return fetchShopQuery({country: 'GB'}).then((query) => {
        assert.ok(query.indexOf('query @inContext(country: GB) {') !== -1, query);
        assert.deepEqual(warnings, []);
      });
    });

    test('it issues reads in the market context through the default fetcher', () => {
      let query;

      global.fetch = (url, {body}) => {
        query = JSON.parse(body).query;

        return Promise.resolve({headers: {get: () => 'application/json'}, json: () => shopInfoFixture});
      };

      return Client.buildClient(Object.assign({}, config, {country: 'GB'})).shop.fetchInfo().then(() => {
        assert.ok(query.indexOf('query @inContext(country: GB) {') !== -1, query);
      });
    });

    test('it keeps an Accept-Language style language config out of the query document', () => {
      return fetchShopQuery({language: 'ja-JP'}).then((query) => {
        assert.equal(query.indexOf('@inContext'), -1, query);
        assert.deepEqual(warnings, []);
      });
    });

    test('it sends only the country in the market context when a language is also configured', () => {
      return fetchShopQuery({country: 'GB', language: 'ja-JP'}).then((query) => {
        assert.ok(query.indexOf('query @inContext(country: GB) {') !== -1, query);
      });
    });

    function captureRequest(extraConfig, run) {
      let request = null;

      function fetchFunction(url, {body}) {
        request = JSON.parse(body);

        return Promise.resolve({json: () => ({data: {}})});
      }

      const client = new Client(new Config(Object.assign({}, config, extraConfig)), GraphQLJSClient, fetchFunction);

      function settled(outcome) {
        return {request, outcome};
      }

      return run(client).then(settled, settled);
    }

    test('it passes query variables through with the market context', () => {
      const query = 'query ($id: ID!) {node(id: $id) {id}}';

      return captureRequest({country: 'GB'}, (client) => client.graphQLClient.fetcher({query, variables: {id: '1'}})).then(({request}) => {
        assert.deepEqual(request, {query: 'query ($id: ID!) @inContext(country: GB) {node(id: $id) {id}}', variables: {id: '1'}});
      });
    });

    test('it creates a checkout with a buyer country Shopify accepts, without the market context', () => {
      return captureRequest({country: 'GB'}, (client) => client.checkout.create({buyerIdentity: {countryCode: 'GB'}})).then(({request}) => {
        assert.deepEqual(request.variables, {input: {buyerIdentity: {countryCode: 'GB'}}});
        assert.equal(request.query.indexOf('@inContext'), -1, request.query);
        assert.deepEqual(warnings, []);
      });
    });

    test('it creates a checkout without warning when buyerIdentity carries no country', () => {
      return captureRequest({}, (client) => client.checkout.create({buyerIdentity: {}})).then(({request}) => {
        assert.deepEqual(request.variables, {input: {buyerIdentity: {}}});
        assert.deepEqual(warnings, []);
      });
    });

    test('it warns and creates a checkout without a buyer country Shopify does not accept', () => {
      return captureRequest({}, (client) => client.checkout.create({buyerIdentity: {countryCode: 'UK'}})).then(({request}) => {
        assert.deepEqual(request.variables, {input: {buyerIdentity: {}}});
        assert.deepEqual(warnings, ["[ShopifyBuy] Ignoring buyerIdentity.countryCode 'UK': not a Shopify CountryCode such as 'GB'."]);
      });
    });

    test('it sends the new buyer country of an existing checkout', () => {
      return captureRequest({country: 'GB'}, (client) => client.checkout.updateBuyerCountry('gid://shopify/Cart/1', 'US')).then(({request}) => {
        assert.deepEqual(request.variables, {buyerIdentity: {countryCode: 'US'}, cartId: 'gid://shopify/Cart/1'});
        assert.ok(request.query.indexOf('mutation CartBuyerIdentityUpdate ') !== -1, request.query);
        assert.equal(request.query.indexOf('@inContext'), -1, request.query);
      });
    });

    let missingCountry;

    [missingCountry, 'UK'].forEach((country) => {
      test(`it rejects the buyer country '${country}' for an existing checkout without sending it`, () => {
        return captureRequest({}, (client) => client.checkout.updateBuyerCountry('gid://shopify/Cart/1', country)).then(({request, outcome}) => {
          assert.strictEqual(request, null);
          assert.ok(outcome instanceof Error, String(outcome));
        });
      });
    });

    [['gb', "'gb'"], ['UK', "'UK'"], [44, 'number']].forEach(([country, shown]) => {
      test(`it warns and issues plain reads for the country config ${shown}, which Shopify does not accept`, () => {
        return fetchShopQuery({country}).then((query) => {
          assert.equal(query.indexOf('@inContext'), -1, query);
          assert.deepEqual(warnings, [`[ShopifyBuy] Ignoring config.country ${shown}: not a Shopify CountryCode such as 'GB'.`]);
        });
      });
    });
  });
});
