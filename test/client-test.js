import assert from 'assert';
import GraphQLJSClient from '../src/graphql-client';
import Config, {DEFAULT_API_VERSION} from '../src/config';
import Client from '../src/client';
import types from '../schema.json';
import {version} from '../package.json';

suite('client-test', () => {
  const config = {
    domain: 'grapqhql.myshopify.com',
    storefrontAccessToken: '595005d0c565f6969eece280de85edb5',
    apiVersion: '2026-07'
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

  /**
   * The assertion above compares the request URL against `config.apiVersion`, but it cannot tell
   * a working config from a hardcoded literal: it only ever passed the version that happened to
   * be baked into the client. These two pin the behaviour it was assumed to cover -- a version
   * the caller chose, and the default when they choose nothing.
   */
  test('it honours a requested apiVersion that differs from the default', () => {
    let passedUrl;

    class FakeGraphQLJSClient {
      constructor(typeBundle, {url}) {
        passedUrl = url;
      }
    }

    const requestedVersion = '2026-04';

    assert.notEqual(requestedVersion, DEFAULT_API_VERSION, 'pick a version the default cannot mask');

    new Client(new Config(Object.assign({}, config, {apiVersion: requestedVersion})), FakeGraphQLJSClient); // eslint-disable-line no-new

    assert.equal(passedUrl.split('?')[0], `https://${config.domain}/api/${requestedVersion}/graphql`);
  });

  test('Config supplies the default apiVersion when none is given', () => {
    let passedUrl;

    class FakeGraphQLJSClient {
      constructor(typeBundle, {url}) {
        passedUrl = url;
      }
    }

    const withoutApiVersion = {
      domain: config.domain,
      storefrontAccessToken: config.storefrontAccessToken
    };

    new Client(new Config(withoutApiVersion), FakeGraphQLJSClient); // eslint-disable-line no-new

    assert.equal(passedUrl.split('?')[0], `https://${config.domain}/api/${DEFAULT_API_VERSION}/graphql`);
  });

  /**
   * The test above goes through `Config`, which has already filled in the default by the time the
   * client sees it — so it does not reach the client's own fallback. `Client` is the bundle's
   * default export and its constructor is reachable without `buildClient`, which is the case that
   * fallback exists for. Passing the plain object is the only way to exercise it: delete the
   * `|| DEFAULT_API_VERSION` in client.js and this is the test that fails.
   */
  test('the client falls back to the default when constructed without a Config', () => {
    let passedUrl;

    class FakeGraphQLJSClient {
      constructor(typeBundle, {url}) {
        passedUrl = url;
      }
    }

    const plainObjectWithoutApiVersion = {
      domain: config.domain,
      storefrontAccessToken: config.storefrontAccessToken
    };

    new Client(plainObjectWithoutApiVersion, FakeGraphQLJSClient); // eslint-disable-line no-new

    assert.equal(passedUrl.split('?')[0], `https://${config.domain}/api/${DEFAULT_API_VERSION}/graphql`);
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
});
