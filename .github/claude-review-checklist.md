# Claude review checklist for shopify-buy-sdk

Repo-specific review rules, spliced into the shared review workflow's prompt
(see hellojuniper-com/claude-workflows). This is Juniper's PUBLIC fork of
Shopify's js-buy-sdk, published to GitHub Packages as
`@hellojuniper-com/shopify-buy` and consumed, pinned to exact versions, by
juniper-react's StoreClient on every storefront. Upstream deprecated the SDK
in January 2025, so every change here is self-maintained. The default branch
is `juniper-main`; README, CONTRIBUTING, DEPLOYING and CHANGELOG are
upstream Shopify documents and are NOT authoritative for this fork's
processes (no shipit, no changesets - releasing is a version bump in the PR
plus a GitHub release that triggers npm-publish-github-packages.yml).

Disable "Accessibility": client library, no UI surface.

## Public repo hygiene [Blocker]

- This repository is public. No Juniper-internal secrets, tokens, store
  credentials, private URLs, or customer data may appear in source, tests,
  fixtures, docs, or workflow files - fixtures use Shopify's public demo
  shapes, keep it that way.
- Workflow changes must never hand secrets to fork PRs: flag any switch to
  `pull_request_target` that checks out PR code, and any removal of a
  same-repo guard (`github.event.pull_request.head.repo.full_name ==
  github.repository`).

## TypeScript 3.3 compatibility [Blocker]

- `index.d.ts` and `typescript/` must stay compilable by TypeScript 3.3:
  juniper-react pins typescript 3.3.3333 and breaks on newer declaration
  syntax. The `check:no-import-type` prebuild guard enforces the known
  killer (`import type`); flag its removal or weakening, and flag other
  post-3.3 syntax (`unknown` in new positions, optional chaining, `as
  const`) introduced into the published declarations.

## Storefront API and metafields [Critical]

- The GraphQL documents in `src/graphql/` define what every storefront
  fetches. A newly requested metafield (e.g. `productListing.*`) resolves
  to null unless its metafield definition exists in ALL THREE Shopify
  stores (junipersales, junipercreates, another-axiom-x-juniper) - the
  failure is silent. The PR must state that the definitions exist or who
  is creating them; the code change alone is not shippable.
- v3 of the SDK replaced the deprecated Checkout APIs with Cart APIs.
  Flag any reintroduction of checkout-API calls or fields; cart flows go
  through the cart resources and `cart-payload-mapper`.
- Changes to the targeted Storefront API version affect every query in
  the SDK at once; they need explicit verification notes, not just a
  passing unit suite.

## Fork discipline [High]

- Keep the diff against upstream surgical: contain Juniper-specific
  behavior in its own fragments/fields/modules and avoid refactoring
  upstream code for style, or future upstream comparison and cherry-picks
  become impossible.
- Inherited upstream workflows (tests.yml, npm-release.yml, snapit.yml)
  reference upstream's `main` branch and release tooling; npm-release and
  snapit are inert here. Flag changes that build on them instead of the
  fork's own flows (build-test-on-pull-request.yml,
  npm-publish-github-packages.yml).

## Versioning and publishing [High]

- Consumers pin exact versions, so nothing ships at merge: the change
  reaches storefronts only after a GitHub release publishes the package
  and juniper-react bumps its pinned version. A behavior-changing PR
  should carry the package.json version bump (see PR #54 for the pattern)
  and say which consumer bump adopts it.

## Testing [High]

- `npm test` runs the full pipeline: clean, tsc build, the node and
  browser mocha suites, then jest. Tests live in `test/` with API
  payloads in `fixtures/`; expect new resources, fragments, or mappers to
  come with fixture-backed coverage. CI runs both the `execute` job and
  the inherited `tests` job - both must stay green.
