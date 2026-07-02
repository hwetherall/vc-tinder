# NinjaPear Overview

NinjaPear is a B2B Company Intelligence platform focused on data ownership and ethical sourcing. As a first-party provider, we maintain a sustainable ecosystem of proprietary and legally vetted data. Our mission is to provide a reliable data infrastructure, enabling businesses to develop and scale value-added applications and workflows with confidence.

## For AI Agents

Building with an AI coding agent? Use the plain Markdown version of these docs — optimized for LLMs and AI tools like Claude, Cursor, and ChatGPT:

- **[LLM-friendly docs (Markdown)](https://nubela.co/llms-full.txt)** — full API reference as plain text, ready to paste or drag-and-drop into any AI chat
- **[llms.txt](https://nubela.co/llms.txt)** — lightweight index for AI agent discovery
- **[OpenAPI 3.0 Spec](https://nubela.co/api/openapi3.yaml)** — machine-readable API schema

## AI Skill

The NinjaPear AI Skill gives coding agents the procedural knowledge to write correct NinjaPear integration code in your applications. Install it with a single command and your agent will know how to authenticate, choose the right endpoint, generate SDK code, and handle edge cases — all with cost awareness built in.

- [GitHub repository](https://github.com/NinjaPear/ninjapear-skill)

<aside class="notice">The AI Skill teaches coding agents <em>how to write code</em> that calls NinjaPear. It does not call the NinjaPear API itself. For direct conversational querying of company data, see the <a href="#claude-ai">Claude AI</a> MCP integration.</aside>

**Prerequisites** — A NinjaPear API key from [nubela.co/dashboard](https://nubela.co/dashboard) and Node.js 18+.

Install the skill using the `npx skills` CLI. Choose the command for your agent:

### Claude Code

`npx skills add NinjaPear/ninjapear-skill -a claude-code`

### Codex

`npx skills add NinjaPear/ninjapear-skill -a codex`

### Opencode

`npx skills add NinjaPear/ninjapear-skill -a opencode`

<aside class="notice">Add the <code>-g</code> flag for a global (user-level) install instead of project-level. Example: <code>npx skills add NinjaPear/ninjapear-skill -a claude-code -g</code></aside>

### What the Skill Provides

Once installed, the skill gives your coding agent procedural knowledge to work with NinjaPear correctly:

| Capability                 | Description                                                         |
| -------------------------- | ------------------------------------------------------------------- |
| Authentication setup       | Configure API keys via environment variables and SDK initialization |
| Endpoint selection         | Choose the right NinjaPear API endpoint with cost awareness         |
| Python SDK integration     | Generate correct code using the `ninjapear` Python package          |
| JavaScript SDK integration | Generate correct code using the `ninjapear` npm package             |
| Pagination handling        | Implement cursor-based pagination for list endpoints                |
| Rate limit handling        | Respect rate limits with proper retry and backoff logic             |
| Error handling             | Handle all NinjaPear error codes (401, 403, 404, 429, 500, 503)     |
| Timeout configuration      | Set appropriate timeouts for long-running endpoints                 |

## Explain it to me like I'm 5

- Get a list of customers, investors, and partners of any company with the [Customer Listing Endpoint](#customer-listing-endpoint).
- Find competitors of any company and why they compete with the [Competitor Listing Endpoint](#competitor-listing-endpoint).
- Get a company's product and service catalog with the [Product Listing Endpoint](#product-listing-endpoint).
- Get the logo of any company for free with the [Company Logo Endpoint](#company-logo-endpoint).
- Get full company details like industry, description, executives, and office locations with the [Company Details Endpoint](#company-details-endpoint).
- Get the employee count of any company with the [Employee Count Endpoint](#employee-count-endpoint).
- Get recent blog posts and social media updates of any company with the [Company Updates Endpoint](#company-updates-endpoint).
- Get the full funding history and investors of any company with the [Company Funding Endpoint](#company-funding-endpoint).
- Resolve a company name to its canonical website URL with the [Website Lookup Endpoint](#website-lookup-endpoint).
- Find the work email of a person given their name and company domain with the [Work Email Endpoint](#work-email-endpoint).
- Look up a person's profile, job history, and education from their work email with the [Person Profile Endpoint](#person-profile-endpoint).
- Find people similar to a target person — same role at competing companies — with the [Similar People Endpoint](#similar-people-endpoint).
- Check if an email address is disposable or from a free email provider with the [Disposable Email Checker Endpoint](#disposable-email-checker-endpoint).
- Monitor companies for new blog posts, tweets, and website changes via RSS with the [Monitor API](#monitor-api).
- Check your remaining API credits with the [View Credit Balance Endpoint](#view-credit-balance-endpoint).

## Authentication

```shell
curl "https://nubela.co/api/v1/customer/listing" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

with ninjapear.ApiClient(configuration) as api_client:
    api = ninjapear.CustomerAPIApi(api_client)
    response = api.get_customer_listing(website="https://example.com")
```

```javascript
var NinjaPear = require("ninjapear");
var defaultClient = NinjaPear.ApiClient.instance;
var bearerAuth = defaultClient.authentications["bearerAuth"];
bearerAuth.accessToken = "YOUR_API_KEY";

var api = new NinjaPear.CustomerAPIApi();
api.getCustomerListing("https://example.com").then(function (data) {
  console.log(data);
});
```

NinjaPear's API uses bearer tokens to authenticate users. Each user is assigned a randomly generated secret key under the [API section in the dashboard](https://nubela.co/dashboard).

The bearer token is injected in the `Authorization` header.

## Client Libraries

We provide official client libraries for JavaScript and Python to make integrating with the NinjaPear API easier.

### JavaScript (Node.js)

```shell
npm install ninjapear
```

```python
# JavaScript library - see JavaScript tab
```

```javascript
var NinjaPear = require("ninjapear");
var defaultClient = NinjaPear.ApiClient.instance;
var bearerAuth = defaultClient.authentications["bearerAuth"];
bearerAuth.accessToken = "YOUR_API_KEY";

// Now you can use any API class
var companyApi = new NinjaPear.CompanyAPIApi();
var customerApi = new NinjaPear.CustomerAPIApi();
var productApi = new NinjaPear.ProductAPIApi();
var contactApi = new NinjaPear.ContactAPIApi();
var metaApi = new NinjaPear.MetaAPIApi();
```

- [npm package](https://www.npmjs.com/package/ninjapear)
- [GitHub repository](https://github.com/NinjaPear/ninjapear-js)

### Python

```shell
uv add ninjapear
# or: pip install ninjapear
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

# Use the client with a context manager
with ninjapear.ApiClient(configuration) as api_client:
    company_api = ninjapear.CompanyAPIApi(api_client)
    customer_api = ninjapear.CustomerAPIApi(api_client)
    product_api = ninjapear.ProductAPIApi(api_client)
    contact_api = ninjapear.ContactAPIApi(api_client)
    meta_api = ninjapear.MetaAPIApi(api_client)
```

```javascript
// Python library - see Python tab
```

- [PyPI package](https://pypi.org/project/ninjapear/)
- [GitHub repository](https://github.com/NinjaPear/ninjapear-py)

## Rate limit

Rate limits are enforced per product account and shared by all API keys under that product.

Paid API endpoints are limited to `50` requests per minute.

For rate limiting, Monitor feed and target management endpoints count as paid API traffic even when the endpoint's credit cost is `0`.

At periods of high load, our system might tighten rate limits for all accounts to ensure that our services remain accessible for all users.

We return HTTP `429` when you are rate limited. You can also receive HTTP `429` if capacity on our end limits us.

You should handle 429 errors and apply exponential backoff.

Rate-limited responses include:

| Header                    | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `Retry-After`             | Seconds to wait before retrying                  |
| `X-RateLimit-Limit`       | Maximum requests allowed in the current minute   |
| `X-RateLimit-Remaining`   | Requests remaining in the current minute         |
| `X-RateLimit-Reset`       | Unix timestamp when the current minute resets    |

### Rate limit for Free APIs

To sustainably provide free APIs, rate limit for free APIs depends on your subscription plan:

- Free, trial, or PAYG plan: 2 requests/min
- $49/mo plan: 20 requests/min
- $299/mo plan: 50 requests/min
- $899/mo plan: 100 requests/min
- $1899/mo plan: 300 requests/min

The free API rate limit applies to Company Logo, Disposable Email Checker, View Credit Balance, and RSS feed consumption.

## Credits

Each valid request requires at least `0.1` credit to be processed, unless it is a free API endpoint.

A credit is consumed if and only if the request is parsed successfully.

A successful request is a request that returns with a `200` HTTP status code.

## Cache Billing

For endpoints with a `use_cache` parameter, a product is not charged again when the same normalized request is served from the same cached record version that the product previously paid for. The response includes `X-NinjaPear-Credit-Cost: 0` for these repeat cache hits.

`use_cache=never` always performs a fresh pull and charges normally. `use_cache=if-recent` only qualifies for a free repeat while the cached record is within that endpoint's freshness window.

For paginated endpoints, free repeat access is limited to pages already paid for with the same query, filters, cursor chain, and `page_size`. Paid paginated pages are replayed exactly on repeat cache hits, including the `next_page` value. Later pages that have not been paid for yet still charge normally.

## Timeouts and API response time

NinjaPear API endpoints take `30-60` seconds to complete.

You are encouraged to make concurrent requests to our API service to maximize throughput. See [this post](https://nubela.co/blog/how-to-maximize-throughput-on-proxycurl/) on how you can maximise throughput.

We recommend a timeout of `100` seconds.

## Errors

These are the common errors that could be returned by our API:

| HTTP Code | Charge? | Description                                                                                |
| --------- | ------- | ------------------------------------------------------------------------------------------ |
| 400       | No      | Invalid parameters provided. Refer to the documentation and message body for more info     |
| 401       | No      | Invalid API Key                                                                            |
| 403       | No      | You have run out of credits                                                                |
| 404       | Yes     | The requested resource (e.g., user profile, company) could not be found                    |
| 410       | No      | This API is deprecated                                                                     |
| 429       | No      | Rate limited. Please retry                                                                 |
| 500       | No      | There is an error with our API. Please [Contact us](mailto:hello@nubela.co) for assistance |
| 503       | No      | Enrichment failed, please retry.                                                           |

You will never be charged for **failed requests**.

## Backward Compatibility Guarantee

We are committed to ensuring that our API remains backward compatible, allowing you to integrate with confidence. Our backward compatibility guarantee means that we will not introduce changes that break existing functionality or remove endpoints without a deprecation period.

To be specific, we will not introduce breaking changes in the following ways:

1. We will not remove documented parameters and response attributes.
2. We will not change the data type as documented in our API responses.

However, the following are not considered breaking changes:

- Adding attributes/parameters to API endpoints without prior notice.
- Adding additional response or requests headers to our API endpoints without prior notice.

We highly recommend integrating our API in a way that would not break should new response attributes or headers be introduced.

If we make changes to our API, we will provide clear documentation and sufficient notice (30 days) to ensure a seamless transition. Notices will be shared via newsletter emails, Twitter/X posts and updates to our blog.

# Customer API

## Customer Listing Endpoint

`GET /api/v1/customer/listing`

Cost: `1` credit / request + `2` credit / company returned. Credits are charged even when the request returns an empty result.

Get a list of highly-probable customers, investors, and partners/platforms of a target company, categorized by relationship type.

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --data-urlencode "website=https://www.stripe.com" \
  "https://nubela.co/api/v1/customer/listing"
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

with ninjapear.ApiClient(configuration) as api_client:
    api = ninjapear.CustomerAPIApi(api_client)
    response = api.get_customer_listing(website="https://www.stripe.com")
    print(response)
```

```javascript
var NinjaPear = require("ninjapear");
var defaultClient = NinjaPear.ApiClient.instance;
defaultClient.authentications["bearerAuth"].accessToken = "YOUR_API_KEY";

var api = new NinjaPear.CustomerAPIApi();
api.getCustomerListing("https://www.stripe.com").then(function (data) {
  console.log(data);
});
```

> Example response:

```json
{
  "customers": [
    {
      "name": "Apple",
      "description": "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.",
      "tagline": "Think different.",
      "website": "https://www.apple.com",
      "company_logo_url": "https://nubela.co/api/v1/company/logo?website=https%3A%2F%2Fwww.apple.com",
      "id": "abc123",
      "industry": 45202030,
      "specialties": ["Technology", "Consumer Electronics"],
      "x_profile": "https://x.com/Apple"
    }
  ],
  "investors": [
    {
      "name": "Sequoia Capital",
      "description": "Sequoia Capital is a venture capital firm focused on technology companies.",
      "tagline": null,
      "website": "https://www.sequoiacap.com",
      "company_logo_url": "https://nubela.co/api/v1/company/logo?website=https%3A%2F%2Fwww.sequoiacap.com",
      "id": "def456",
      "industry": 40203010,
      "specialties": ["Venture Capital", "Growth Equity"],
      "x_profile": "https://x.com/sequoia"
    }
  ],
  "partner_platforms": [
    {
      "name": "Amazon Web Services",
      "description": "Amazon Web Services provides cloud computing platforms and APIs.",
      "tagline": null,
      "website": "https://aws.amazon.com",
      "company_logo_url": "https://nubela.co/api/v1/company/logo?website=https%3A%2F%2Faws.amazon.com",
      "id": "ghi789",
      "industry": 45101010,
      "specialties": ["Cloud Computing", "Infrastructure"],
      "x_profile": "https://x.com/awscloud"
    }
  ],
  "next_page": "https://nubela.co/api/v1/customer/listing?website=https://www.stripe.com&cursor=abc123"
}
```

### URL Parameters

| Parameter        | Required | Description                                                                                                                                       | Example                  |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `website`        | Yes      | The website URL or company name of the target company. A website URL (e.g. `https://www.stripe.com`) is strongly recommended for precision.      | `https://www.stripe.com` |
| `cursor`         | No       | Pagination cursor from `next_page` in a previous response                                                                                         | `abc123`                 |
| `page_size`      | No       | Number of results per page (1-200, default 200)                                                                                                   | `50`                     |
| `quality_filter` | No       | Filter out low-quality results (junk TLDs like `.top`, `.xyz` and unreachable websites). Set to `false` to include all results. (default: `true`) | `false`                  |
| `use_cache`      | No       | Controls cache usage. Case-insensitive. Values: `if-recent` (use cached data when the last scrape is within 29 days, otherwise enrich live), `if-present` (default; return cache first, enrich live if absent), `if-present-only` (return cache only; return 404 if absent), `never` (always enrich live). Invalid values fall back to the endpoint default. | `if-present`            |

### Response

| Key                 | Description                                                                                                                                                             | Example                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `customers`         | A list of companies that are probable customers of the target company. Entities that pay for the target's product/service.                                              | List of CustomerCompany objects              |
| `investors`         | A list of companies that are investors (VC firms, PE funds, angel networks) of the target company.                                                                      | List of CustomerCompany objects              |
| `partner_platforms` | A list of companies that are partners, platforms, or service providers the target company uses or integrates with (tech stack, media, agencies).                        | List of CustomerCompany objects              |
| `next_page`         | The API URI that serves as the cursor for pagination. Following this URL with your API key will lead to the next page of results. This will be null for the final page. | `https://nubela.co/api/v1/customer/list?...` |

### Error Codes

| Status Code | Charged? | Description                                                   |
| ----------- | -------- | ------------------------------------------------------------- |
| 400         | No       | Unable to extract enough information about the target company |
| 404         | No       | No cached data found when `use_cache=if-present-only`         |

### CustomerCompany

| Key                | Description                                                                                                                                                          | Example                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `name`             | Company name                                                                                                                                                         | `"Apple"`                                                                     |
| `description`      | A brief description of the company                                                                                                                                   | `"Apple Inc. designs, manufactures, and markets smartphones..."`              |
| `tagline`          | Company tagline or slogan                                                                                                                                            | `"Think different."`                                                          |
| `website`          | Company website URL                                                                                                                                                  | `"https://www.apple.com"`                                                     |
| `company_logo_url` | URL to the Company Logo API for this company. Powered by [Company Logo Endpoint](#company-logo-endpoint). Authenticate with your bearer token. `null` if no website. | `"https://nubela.co/api/v1/company/logo?website=https%3A%2F%2Fwww.apple.com"` |
| `id`               | Unique identifier                                                                                                                                                    | `"abc123"`                                                                    |
| `industry`         | GICS 8-digit industry code                                                                                                                                           | `45202030`                                                                    |
| `specialties`      | List of company specialties                                                                                                                                          | `["Technology"]`                                                              |
| `x_profile`        | X (Twitter) profile URL                                                                                                                                              | `"https://x.com/Apple"`                                                       |

> **Note on `company_logo_url`:** This URL is powered by the [Company Logo Endpoint](#company-logo-endpoint). Authenticate with your Bearer token (same as the main API). These are temporal links — the recommended approach is to download the image via the URL as soon as the response is returned and host the image on your end.

### Response Headers

| Header Key                | Description                             | Example |
| ------------------------- | --------------------------------------- | ------- |
| `X-NinjaPear-Credit-Cost` | Total cost of credits for this API call | `10`    |
| `X-NinjaPear-Cache-Age-Days` | Age of the returned data in whole days. `0` when fresh data is returned from live enrichment. | `12` |

# Competitor API

## Competitor Listing Endpoint

`GET /api/v1/competitor/listing`

Cost: `2` credits / competitor returned. Minimum `5` credits per request, charged even when no results are found.

Get a list of competitor companies for a target company, with the reason for competition.

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --data-urlencode "website=https://www.stripe.com" \
  "https://nubela.co/api/v1/competitor/listing"
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

with ninjapear.ApiClient(configuration) as api_client:
    api = ninjapear.CompetitorAPIApi(api_client)
    response = api.get_competitor_listing(website="https://www.stripe.com")
    print(response)
```

```javascript
var NinjaPear = require("ninjapear");
var defaultClient = NinjaPear.ApiClient.instance;
defaultClient.authentications["bearerAuth"].accessToken = "YOUR_API_KEY";

var api = new NinjaPear.CompetitorAPIApi();
api.getCompetitorListing("https://www.stripe.com").then(function (data) {
  console.log(data);
});
```

> Example response:

```json
{
  "competitors": [
    {
      "company_details_url": "https://nubela.co/api/v1/company/details?website=https://www.adyen.com",
      "website": "https://www.adyen.com",
      "competition_reason": "product_overlap"
    },
    {
      "company_details_url": "https://nubela.co/api/v1/company/details?website=https://squareup.com",
      "website": "https://squareup.com",
      "competition_reason": "product_overlap"
    },
    {
      "company_details_url": "https://nubela.co/api/v1/company/details?website=https://www.checkout.com",
      "website": "https://www.checkout.com",
      "competition_reason": "organic_keyword_overlap"
    }
  ]
}
```

### URL Parameters

| Parameter | Required | Description                           | Example                  |
| --------- | -------- | ------------------------------------- | ------------------------ |
| `website` | Yes      | The website URL or company name of the target company. A website URL (e.g. `https://www.stripe.com`) is strongly recommended for precision. | `https://www.stripe.com` |
| `use_cache` | No     | Controls cache usage. Case-insensitive. Values: `if-recent` (use cached data when the last scrape is within 29 days, otherwise enrich live), `if-present` (default; return cache first, enrich live if absent), `if-present-only` (return cache only; return 404 if absent), `never` (always enrich live). Invalid values fall back to the endpoint default. | `if-present` |

### Response

| Key           | Description                                            | Example                                                 |
| ------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| `competitors` | A list of competitor companies for the target company. | List of [CompetitorCompany](#competitorcompany) objects |

### Error Codes

| Status Code | Charged? | Description                                                   |
| ----------- | -------- | ------------------------------------------------------------- |
| 400         | No       | Unable to extract enough information about the target company |
| 404         | No       | No cached data found when `use_cache=if-present-only`         |

### CompetitorCompany

| Key                   | Description                                                                                                                    | Example                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `company_details_url` | URL to the Company Details endpoint for this competitor. Authenticate with your bearer token to retrieve full company details. | `"https://nubela.co/api/v1/company/details?website=https://www.adyen.com"` |
| `website`             | Company website URL                                                                                                            | `"https://www.adyen.com"`                                                  |
| `competition_reason`  | Why this company is considered a competitor. One of the values from the [Competition Reason](#competition-reason-enum) enum.   | `"product_overlap"`                                                        |

### Competition Reason Enum

| Value                     | Description                                             |
| ------------------------- | ------------------------------------------------------- |
| `organic_keyword_overlap` | Both companies rank for similar organic search keywords |
| `product_overlap`         | Both companies offer similar products or services       |

### Response Headers

| Header Key                | Description                             | Example |
| ------------------------- | --------------------------------------- | ------- |
| `X-NinjaPear-Credit-Cost` | Total cost of credits for this API call | `4`     |
| `X-NinjaPear-Cache-Age-Days` | Age of the returned data in whole days. `0` when fresh data is returned from live enrichment. | `12` |

# Product API

## Product Listing Endpoint

`GET /api/v1/product/listing`

Cost: `3` credits / request. Credits are charged even if no products are found for a valid company.

Get a list of products and services offered by a target company.

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --data-urlencode "website=https://matterport.com" \
  "https://nubela.co/api/v1/product/listing"
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

with ninjapear.ApiClient(configuration) as api_client:
    api = ninjapear.ProductAPIApi(api_client)
    response = api.get_product_listing(website="https://matterport.com")
    print(response)
```

```javascript
var NinjaPear = require("ninjapear");
var defaultClient = NinjaPear.ApiClient.instance;
defaultClient.authentications["bearerAuth"].accessToken = "YOUR_API_KEY";

var api = new NinjaPear.ProductAPIApi();
api.getProductListing("https://matterport.com").then(function (data) {
  console.log(data);
});
```

> Example response:

```json
{
  "products": [
    {
      "name": "Matterport Digital Twin Platform",
      "tagline": "Capture, share, and collaborate in immersive 3D.",
      "description": "Matterport's 3D digital twin platform allows users to create immersive 3D models of physical spaces, enabling virtual tours, detailed measurements, and remote collaboration. It helps optimize space planning, manage costs, and streamline project management across various industries.",
      "categories": [
        "3D Modeling",
        "Digital Twins",
        "Virtual Tours",
        "Real Estate",
        "Construction",
        "Facilities Management"
      ],
      "tags": [],
      "structured_features": {
        "3d_insights": true,
        "centralized_management": true,
        "workplace_planning": true,
        "risk_mitigation": true,
        "bim_cad_generation": true,
        "qa_qc_monitoring": true,
        "asset_documentation": true,
        "space_planning": true,
        "capital_project_execution": true,
        "remote_oversight": true,
        "dimensionally_accurate_data": true,
        "secure_cloud_hosting": true
      },
      "freeform_features": [
        "immersive exploration from the palm of your hand",
        "cut the time and cost of workplace planning",
        "accelerating your ability to execute",
        "unmatched 3D visual clarity"
      ],
      "pricing": {
        "model": "unknown",
        "starts_at_monthly_usd": null,
        "tiers": []
      },
      "integrations": [
        "Procore",
        "Autodesk",
        "AWS"
      ],
      "platforms": [
        "web"
      ],
      "source_urls": [
        "http://matterport.com/",
        "https://go.matterport.com/corporate-occupiers.html",
        "https://matterport.com/solutions/design-construction",
        "http://matterport.com/solutions/corporate-real-estate",
        "http://matterport.com/contact-sales"
      ]
    }
  ]
}
```

### URL Parameters

| Parameter   | Required | Description                                                                                                                                             | Example                  |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `website`   | Yes      | The website URL or company name of the target company. A website URL (e.g. `https://matterport.com`) is strongly recommended for precision.            | `https://matterport.com` |
| `use_cache` | No       | Controls cache usage. Case-insensitive. Values: `if-recent` (default; use cached data when the last scrape is within 29 days, otherwise enrich live), `if-present` (return cache first, enrich live if absent), `if-present-only` (return cache only; return 404 if absent), `never` (always enrich live). Invalid values fall back to the endpoint default. | `if-recent`              |

### Response

| Key        | Description                                                                                                                                                    | Example                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `products` | A list of products and services offered by the target company. Returns an empty list when the company is valid but no products or services are detected.       | List of [Product Object](#product-object) objects |

### Product Object

| Key                   | Description                                                                                                                                                                                                                       | Example                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `name`                | Full product or service name. Distinct named products, SKUs, platforms, or separately priced offerings are returned as separate rows.                                                                                              | `"Matterport Digital Twin Platform"`                                                                          |
| `tagline`             | One-line product tagline when available.                                                                                                                                                                                          | `"Capture, share, and collaborate in immersive 3D."`                                                          |
| `description`         | One to three sentences describing what the product does.                                                                                                                                                                           | `"Matterport's 3D digital twin platform allows users to create immersive 3D models of physical spaces..."`    |
| `categories`          | Product categories, including product class, industry, or use-case groupings supported by the website.                                                                                                                             | `["3D Modeling", "Digital Twins"]`                                                                            |
| `tags`                | Short product attributes, deployment styles, technology labels, or other searchable tags.                                                                                                                                          | `["ai-powered", "self-hosted"]`                                                                               |
| `structured_features` | Feature map using canonical feature keys and boolean, string, or numeric values. Keys vary by product category.                                                                                                                    | `{ "secure_cloud_hosting": true }`                                                                            |
| `freeform_features`   | Feature phrases that do not fit a canonical key.                                                                                                                                                                                  | `["unmatched 3D visual clarity"]`                                                                             |
| `pricing`             | Pricing model, starting price, and tiers when pricing is available. `null` when pricing cannot be determined.                                                                                                                      | [Pricing Object](#pricing-object)                                                                             |
| `integrations`        | Product, platform, or service names this product integrates with.                                                                                                                                                                  | `["Procore", "Autodesk", "AWS"]`                                                                             |
| `platforms`           | Platforms where the product is available, such as `web`, `ios`, `android`, `macos`, `windows`, `linux`, `api`, `cli`, or `chrome-extension`.                                                                                    | `["web"]`                                                                                                     |
| `source_urls`         | URLs from the target company's website where the product data was found.                                                                                                                                                           | `["https://matterport.com/solutions/design-construction"]`                                                    |

### Pricing Object

| Key                     | Description                                                                                  | Example          |
| ----------------------- | -------------------------------------------------------------------------------------------- | ---------------- |
| `model`                 | Pricing model. One of the values from the [Pricing Model Enum](#pricing-model-enum).         | `"subscription"` |
| `starts_at_monthly_usd` | Lowest monthly USD price found on the company's website. `null` when unknown or unavailable. | `29.0`           |
| `tiers`                 | Pricing tiers found on the company's website.                                                | List of [PricingTier Object](#pricingtier-object) objects |

### PricingTier Object

| Key                 | Description                                           | Example                  |
| ------------------- | ----------------------------------------------------- | ------------------------ |
| `name`              | Pricing tier name.                                    | `"Business"`             |
| `price_usd_monthly` | Monthly USD price for this tier. `null` when unknown. | `99.0`                   |
| `features`          | Features listed for this pricing tier.                | `["SSO", "Audit logs"]` |

### Pricing Model Enum

| Value          | Description                                      |
| -------------- | ------------------------------------------------ |
| `freemium`     | Free plan with paid upgrades                     |
| `subscription` | Recurring paid subscription                      |
| `one-time`     | One-time purchase                                |
| `payg`         | Pay-as-you-go pricing                            |
| `enterprise`   | Custom enterprise pricing                        |
| `unknown`      | Pricing exists or may exist, but model is unclear |

### Response Headers

| Header Key                   | Description                                                                                 | Example |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ------- |
| `X-NinjaPear-Credit-Cost`    | Total cost of credits for this API call                                                     | `3`     |
| `X-NinjaPear-Cache-Age-Days` | Age of the returned data in whole days. `0` when fresh data is returned from live enrichment. | `12`    |

### Error Codes

| Status Code | Charged? | Description                                                    |
| ----------- | -------- | -------------------------------------------------------------- |
| 400         | No       | Website is unreachable or the input is invalid                 |
| 404         | No       | No cached data found when `use_cache=if-present-only`          |
| 503         | No       | Crawl capacity is temporarily saturated. Retry after a short delay. |

# Company API

## Company Logo Endpoint

`GET /api/v1/company/logo`

Cost: `0` credit / successful request. (FREE)

Retrieve the logo of a company given its website URL. Returns the logo as a PNG image (128x128).

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --data-urlencode "website=https://www.stripe.com" \
  "https://nubela.co/api/v1/company/logo" \
  --output logo.png
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

with ninjapear.ApiClient(configuration) as api_client:
    api = ninjapear.CompanyAPIApi(api_client)
    logo_data = api.get_company_logo(website="https://www.stripe.com")

    # Save the logo image
    with open("logo.png", "wb") as f:
        f.write(logo_data)
```

```javascript
var NinjaPear = require("ninjapear");
var fs = require("fs");
var defaultClient = NinjaPear.ApiClient.instance;
defaultClient.authentications["bearerAuth"].accessToken = "YOUR_API_KEY";

var api = new NinjaPear.CompanyAPIApi();
api.getCompanyLogo("https://www.stripe.com").then(function (data) {
  // Save the logo image
  fs.writeFileSync("logo.png", Buffer.from(data));
});
```

> Example response:

> ![Company Logo Example](/assets/docs/company-logo-example.png)

A raw PNG image binary (Content-Type: `image/png`).

### URL Parameters

| Parameter | Required | Description                           | Example                  |
| --------- | -------- | ------------------------------------- | ------------------------ |
| `website` | Yes      | The website URL of the target company | `https://www.stripe.com` |

### Response

A `200` response returns the logo as a raw PNG image with `Content-Type: image/png`.

### Error Codes

| Status Code | Charged? | Description                        |
| ----------- | -------- | ---------------------------------- |
| 404         | No       | No logo found for the given domain |

### Response Headers

| Header Key                | Description                             | Example |
| ------------------------- | --------------------------------------- | ------- |
| `X-NinjaPear-Credit-Cost` | Total cost of credits for this API call | `0`     |

## Company Details Endpoint

`GET /api/v1/company/details`

![Avg 8.1s](https://img.shields.io/badge/Avg-8.1s-16a34a)

Cost: `3` credits / request (base). Add `2` credits when `include_employee_count=true`. Add `1` credit when `follower_count=include`. Add `2` credits when `addresses=best-effort-exhaustive`. Maximum total: `8` credits. Credits are charged even if no data found.

Retrieve the details of a company given its website URL. Returns company metadata including description, industry, social media URLs, the current leadership team, and more.

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --data-urlencode "website=https://www.stripe.com" \
  "https://nubela.co/api/v1/company/details"
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

with ninjapear.ApiClient(configuration) as api_client:
    api = ninjapear.CompanyAPIApi(api_client)
    details = api.get_company_details(website="https://www.stripe.com")
    print(details)
```

```javascript
var NinjaPear = require("ninjapear");
var defaultClient = NinjaPear.ApiClient.instance;
defaultClient.authentications["bearerAuth"].accessToken = "YOUR_API_KEY";

var api = new NinjaPear.CompanyAPIApi();
api.getCompanyDetails("https://www.stripe.com").then(function (data) {
  console.log(data);
});
```

> Example response (private company):

```json
{
  "websites": ["https://stripe.com", "https://stripe.dev"],
  "description": "Stripe is a technology company that builds economic infrastructure for the internet.",
  "industry": 45102010,
  "company_type": "PRIVATELY_HELD",
  "founded_year": 2010,
  "specialties": ["Payments", "Financial Services", "APIs"],
  "name": "Stripe",
  "tagline": "Financial infrastructure for the internet",
  "logo_url": "https://nubela.co/api/v1/company/logo?website=https://stripe.com",
  "cover_pic_url": "https://example.com/stripe-cover.png",
  "facebook_url": "https://facebook.com/stripe",
  "twitter_url": "https://twitter.com/stripe",
  "instagram_url": null,
  "linkedin_url": "https://www.linkedin.com/company/stripe",
  "employee_count": 8000,
  "addresses": [
    {
      "address_type": "HEADQUARTERS",
      "line1": "354 Oyster Point Blvd",
      "line2": null,
      "city": "South San Francisco",
      "state": "CA",
      "postal_code": "94080",
      "country_code": "US",
      "country": "United States",
      "is_primary": true
    }
  ],
  "executives": [
    {
      "name": "Patrick Collison",
      "title": "Chief Executive Officer",
      "role": "CEO",
      "person_profile_url": "https://nubela.co/api/v2/employee/profile?employer_website=https%3A%2F%2Fstripe.com&first_name=Patrick&last_name=Collison"
    }
  ],
  "similar_companies": "https://nubela.co/api/v1/competitor/listing?website=https%3A%2F%2Fstripe.com",
  "updates": "https://nubela.co/api/v1/company/updates?website=https%3A%2F%2Fstripe.com",
  "funding": "https://nubela.co/api/v1/company/funding?website=https%3A%2F%2Fstripe.com",
  "public_listing": null,
  "follower_count": 272190,
  "following_count": 555
}
```

> Example response (public company):

```json
{
  "websites": ["https://apple.com"],
  "description": "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.",
  "industry": 45202030,
  "company_type": "PUBLIC_COMPANY",
  "founded_year": 1976,
  "specialties": ["Consumer Electronics", "Software", "Services"],
  "name": "Apple",
  "tagline": "Think different",
  "logo_url": "https://nubela.co/api/v1/company/logo?website=https://apple.com",
  "cover_pic_url": "https://example.com/apple-cover.png",
  "facebook_url": "https://facebook.com/apple",
  "twitter_url": "https://twitter.com/apple",
  "instagram_url": "https://instagram.com/apple",
  "linkedin_url": "https://www.linkedin.com/company/apple",
  "employee_count": 164000,
  "addresses": [
    {
      "address_type": "HEADQUARTERS",
      "line1": "One Apple Park Way",
      "line2": null,
      "city": "Cupertino",
      "state": "CA",
      "postal_code": "95014",
      "country_code": "US",
      "country": "United States",
      "is_primary": true
    }
  ],
  "executives": [
    {
      "name": "Tim Cook",
      "title": "Chief Executive Officer",
      "role": "CEO",
      "person_profile_url": "https://nubela.co/api/v2/employee/profile?employer_website=https%3A%2F%2Fapple.com&first_name=Tim&last_name=Cook"
    }
  ],
  "similar_companies": "https://nubela.co/api/v1/competitor/listing?website=https%3A%2F%2Fapple.com",
  "updates": "https://nubela.co/api/v1/company/updates?website=https%3A%2F%2Fapple.com",
  "funding": "https://nubela.co/api/v1/company/funding?website=https%3A%2F%2Fapple.com",
  "follower_count": 9500000,
  "following_count": 1,
  "public_listing": {
    "stock_symbol": "AAPL",
    "ipo_date": "1980-12-12",
    "isin": "US0378331005",
    "figi": "BBG000B9XRY4",
    "cusip": "037833100",
    "lei": "HWUPKR0MPOU8FGXBT394",
    "cik": "0000320193",
    "sic_code": "3571",
    "revenue_usd": 383285000000,
    "revenue_captured_at": "2024-09-28",
    "ebitda_usd": 134000000000,
    "ebitda_captured_at": "2024-09-28"
  }
}
```

### URL Parameters

| Parameter                | Required | Description                                                                                                                                             | Example                  |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `website`                | Yes      | The website URL or company name of the target company. A website URL (e.g. `https://www.stripe.com`) is strongly recommended for precision.            | `https://www.stripe.com` |
| `include_employee_count` | No       | Fetch fresh employee count data via web search. Adds `2` credits to the request cost. Valid values: `true`, `false` (default).                          | `true`                   |
| `follower_count`         | No       | Include Twitter/X follower and following counts. Adds `1` credit to the request cost. Valid values: `include`. Omit or pass any other value to exclude. | `include`                |
| `addresses`              | No       | Address detail mode. Defaults to `hq-only`. Use `best-effort-exhaustive` to fetch and persist best-effort corporate physical office addresses globally. Adds `2` credits to the request cost. | `best-effort-exhaustive` |
| `use_cache`              | No       | Controls cache usage. Case-insensitive. Values: `if-recent` (default; use cached data when the last scrape is within 29 days, otherwise enrich live), `if-present` (return cache first, enrich live if absent), `if-present-only` (return cache only; return 404 if absent), `never` (always enrich live). Invalid values fall back to the endpoint default. | `if-recent`              |

### Response

| Key                        | Description                                                                                                                          | Example                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `websites`                 | List of all company website URLs                                                                                                     | `["https://stripe.com", "https://stripe.dev"]`                                   |
| `description`              | A brief description of the company                                                                                                   | `"Stripe is a technology company..."`                                            |
| `industry`                 | GICS 8-digit industry code                                                                                                           | `45102010`                                                                       |
| `company_type`             | Type of company (PUBLIC_COMPANY, PRIVATELY_HELD, GOVERNMENT_AGENCY, NON_PROFIT, EDUCATIONAL, PARTNERSHIP, SELF_EMPLOYED, SELF_OWNED) | `"PRIVATELY_HELD"`                                                               |
| `founded_year`             | Year the company was founded                                                                                                         | `2010`                                                                           |
| `specialties`              | List of company specialties                                                                                                          | `["Payments", "Financial Services"]`                                             |
| `name`                     | Company name                                                                                                                         | `"Stripe"`                                                                       |
| `tagline`                  | Company tagline or slogan                                                                                                            | `"Financial infrastructure for the internet"`                                    |
| `logo_url`                 | URL to the [Company Logo endpoint](#company-logo-endpoint). Authenticate with your API key bearer token.                             | `"https://nubela.co/api/v1/company/logo?website=https://stripe.com"`             |
| `cover_pic_url`            | URL to the company's cover/banner image                                                                                              | `"https://example.com/cover.png"`                                                |
| `facebook_url`             | Facebook profile URL                                                                                                                 | `"https://facebook.com/stripe"`                                                  |
| `twitter_url`              | Twitter/X profile URL                                                                                                                | `"https://twitter.com/stripe"`                                                   |
| `instagram_url`            | Instagram profile URL                                                                                                                | `null`                                                                           |
| `linkedin_url`             | LinkedIn profile URL                                                                                                                 | `"https://www.linkedin.com/company/stripe"`                                      |
| `employee_count`           | Estimated number of employees                                                                                                        | `8000`                                                                           |
| `employee_count_range_min` | Lower bound of employee count range. Only present when `include_employee_count=true`.                                                | `7500`                                                                           |
| `employee_count_range_max` | Upper bound of employee count range. Only present when `include_employee_count=true`.                                                | `8500`                                                                           |
| `follower_count`           | Number of Twitter/X followers. Only present when `follower_count=include`.                                                           | `272190`                                                                         |
| `following_count`          | Number of Twitter/X accounts followed. Only present when `follower_count=include`.                                                   | `555`                                                                            |
| `addresses`                | List of company addresses. Defaults to HQ only unless `addresses=best-effort-exhaustive` is requested.                              | \[[Address Object](#address-object)\]                                            |
| `executives`               | List of company executives and board members                                                                                         | \[[Executive Object](#executive-object)\]                                        |
| `similar_companies`        | URL to the [Competitor Listing endpoint](#competitor-listing-endpoint). Authenticate with your bearer token to retrieve competitors. | `"https://nubela.co/api/v1/competitor/listing?website=https%3A%2F%2Fstripe.com"` |
| `updates`                  | URL to the [Company Updates endpoint](#company-updates-endpoint). Authenticate with your bearer token to retrieve updates.           | `"https://nubela.co/api/v1/company/updates?website=https%3A%2F%2Fstripe.com"`    |
| `funding`                  | URL to the [Company Funding endpoint](#company-funding-endpoint). Authenticate with your bearer token to retrieve funding history.   | `"https://nubela.co/api/v1/company/funding?website=https%3A%2F%2Fstripe.com"`    |
| `public_listing`           | Public company data including stock info and financials. `null` for private companies.                                               | [PublicListing Object](#publiclisting-object)                                    |

### Address Object

| Key            | Description                                                        | Example                   |
| -------------- | ------------------------------------------------------------------ | ------------------------- |
| `address_type` | Type of address (HEADQUARTERS, REGISTERED, BRANCH, MAILING, OTHER) | `"HEADQUARTERS"`          |
| `line1`        | Street address line 1                                              | `"354 Oyster Point Blvd"` |
| `line2`        | Street address line 2                                              | `null`                    |
| `city`         | City name                                                          | `"South San Francisco"`   |
| `state`        | State, province, or region                                         | `"CA"`                    |
| `postal_code`  | Postal/ZIP code                                                    | `"94080"`                 |
| `country_code` | ISO 3166-1 alpha-2 country code                                    | `"US"`                    |
| `country`      | Full country name                                                  | `"United States"`         |
| `is_primary`   | Whether this is the primary address                                | `true`                    |

### Executive Object

| Key                  | Description                                                                                                                                                                                                                       | Example                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`               | Full name of the executive                                                                                                                                                                                                        | `"Patrick Collison"`                                                                                                                               |
| `title`              | Job title                                                                                                                                                                                                                         | `"Chief Executive Officer"`                                                                                                                        |
| `role`               | Normalized role type (CEO, CFO, COO, CTO, CMO, PRESIDENT, VICE_PRESIDENT, DIRECTOR, BOARD_MEMBER, CHAIRMAN, FOUNDER, OTHER)                                                                                                       | `"CEO"`                                                                                                                                            |
| `person_profile_url` | Pre-filled URL to the [Person Profile endpoint](#person-profile-endpoint). Authenticate with your bearer token to fetch the executive's profile. `null` when first name or company website is missing.                       | `"https://nubela.co/api/v2/employee/profile?employer_website=https%3A%2F%2Fstripe.com&first_name=Patrick&last_name=Collison"`             |

### PublicListing Object

This object is only present (non-null) for public companies. For private companies, `public_listing` will be `null`.

| Key                   | Description                                      | Example                  |
| --------------------- | ------------------------------------------------ | ------------------------ |
| `stock_symbol`        | Stock ticker symbol                              | `"AAPL"`                 |
| `ipo_date`            | IPO date in ISO format                           | `"1980-12-12"`           |
| `isin`                | International Securities Identification Number   | `"US0378331005"`         |
| `figi`                | Financial Instrument Global Identifier           | `"BBG000B9XRY4"`         |
| `cusip`               | CUSIP identifier                                 | `"037833100"`            |
| `lei`                 | Legal Entity Identifier                          | `"HWUPKR0MPOU8FGXBT394"` |
| `cik`                 | SEC Central Index Key                            | `"0000320193"`           |
| `sic_code`            | SEC Standard Industrial Classification code      | `"3571"`                 |
| `revenue_usd`         | Annual revenue in USD                            | `383285000000`           |
| `revenue_captured_at` | Date when revenue data was captured (ISO format) | `"2024-09-28"`           |
| `ebitda_usd`          | EBITDA in USD                                    | `134000000000`           |
| `ebitda_captured_at`  | Date when EBITDA data was captured (ISO format)  | `"2024-09-28"`           |

### Response Headers

| Header Key                | Description                             | Example |
| ------------------------- | --------------------------------------- | ------- |
| `X-NinjaPear-Credit-Cost` | Total cost of credits for this API call | `2`     |
| `X-NinjaPear-Cache-Age-Days` | Age of the returned data in whole days. `0` when fresh data is returned from live enrichment. | `12` |

### Error Codes

| Status Code | Charged? | Description                                         |
| ----------- | -------- | --------------------------------------------------- |
| 400         | No       | Website is unreachable                              |
| 404         | No       | No cached data found when `use_cache=if-present-only` |
| 404         | Yes      | No company data could be extracted from the website |

## Employee Count Endpoint

`GET /api/v1/company/employee-count`

Cost: `2` credits / successful request.

Retrieve the employee count range for a company given its website URL.

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --data-urlencode "website=https://www.stripe.com" \
  "https://nubela.co/api/v1/company/employee-count"
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

with ninjapear.ApiClient(configuration) as api_client:
    api = ninjapear.CompanyAPIApi(api_client)
    response = api.get_employee_count(website="https://www.stripe.com")
    print(response)
```

```javascript
var NinjaPear = require("ninjapear");
var defaultClient = NinjaPear.ApiClient.instance;
defaultClient.authentications["bearerAuth"].accessToken = "YOUR_API_KEY";

var api = new NinjaPear.CompanyAPIApi();
api.getEmployeeCount("https://www.stripe.com").then(function (data) {
  console.log(data);
});
```

> Example response:

```json
{
  "employee_count": 3500
}
```

### URL Parameters

| Parameter | Required | Description                           | Example                  |
| --------- | -------- | ------------------------------------- | ------------------------ |
| `website` | Yes      | The website URL or company name of the target company. A website URL (e.g. `https://www.stripe.com`) is strongly recommended for precision. | `https://www.stripe.com` |
| `use_cache` | No     | Controls cache usage. Case-insensitive. Values: `if-recent` (default; use cached data when the last scrape is within 29 days, otherwise enrich live), `if-present` (return cache first, enrich live if absent), `if-present-only` (return cache only; return 404 if absent), `never` (always enrich live). Invalid values fall back to the endpoint default. | `if-recent` |

### Response

| Key              | Description              | Example |
| ---------------- | ------------------------ | ------- |
| `employee_count` | Estimated employee count | `3500`  |

### Response Headers

| Header Key                | Description                             | Example |
| ------------------------- | --------------------------------------- | ------- |
| `X-NinjaPear-Credit-Cost` | Total cost of credits for this API call | `2`     |
| `X-NinjaPear-Cache-Age-Days` | Age of the returned data in whole days. `0` when fresh data is returned from live enrichment. | `12` |

### Error Codes

| Status Code | Charged? | Description                                        |
| ----------- | -------- | -------------------------------------------------- |
| 404         | No       | No employee count data found for the given website |
| 404         | No       | No cached data found when `use_cache=if-present-only` |

## Company Updates Endpoint

`GET /api/v1/company/updates`

Cost: `2` credits / request.

Retrieve the latest blog posts and X/Twitter updates for a company. Returns a mixed timeline of recent blog and X posts sorted by timestamp.

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --data-urlencode "website=https://www.stripe.com" \
  "https://nubela.co/api/v1/company/updates"
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

with ninjapear.ApiClient(configuration) as api_client:
    api = ninjapear.CompanyAPIApi(api_client)
    response = api.get_company_updates(website="https://www.stripe.com")
    print(response)
```

```javascript
var NinjaPear = require("ninjapear");
var defaultClient = NinjaPear.ApiClient.instance;
defaultClient.authentications["bearerAuth"].accessToken = "YOUR_API_KEY";

var api = new NinjaPear.CompanyAPIApi();
api.getCompanyUpdates("https://www.stripe.com").then(function (data) {
  console.log(data);
});
```

> Example response

```json
{
  "blogs": ["https://stripe.com/blog/feed.rss"],
  "x_profile": "https://x.com/stripe",
  "youtube_channels": ["https://www.youtube.com/channel/UCdog0Ap82jpFvSnxorxF_lA"],
  "updates": [
    {
      "url": "https://stripe.com/blog/annual-letter-2024",
      "title": "Stripe's annual letter",
      "description": "A look back at what we built in 2024 and what's ahead.",
      "image_url": null,
      "timestamp": "2025-03-01T12:00:00+00:00",
      "source": "blog"
    },
    {
      "url": "https://x.com/stripe/status/1234567890",
      "title": "We just launched a new feature...",
      "description": "We just launched a new feature that makes payments even easier. Check it out!",
      "image_url": "https://pbs.twimg.com/media/example.jpg",
      "timestamp": "2025-02-28T18:30:00+00:00",
      "source": "x"
    },
    {
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "title": "How Stripe scales payments",
      "description": "A deep dive into the infrastructure behind Stripe payments.",
      "image_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "timestamp": "2025-02-20T09:00:00+00:00",
      "source": "youtube"
    }
  ],
  "timestamp": "2025-03-16T10:00:00+00:00"
}
```

### URL Parameters

| Parameter | Required | Description                           | Example                  |
| --------- | -------- | ------------------------------------- | ------------------------ |
| `website` | Yes      | The website URL or company name of the target company. A website URL (e.g. `https://www.stripe.com`) is strongly recommended for precision. | `https://www.stripe.com` |
| `use_cache` | No     | Controls cache usage. Case-insensitive. Values: `if-recent` (default; use cached data when the last scrape is within 1 day, otherwise enrich live), `if-present` (return cache first, enrich live if absent), `if-present-only` (return cache only; return 404 if absent), `never` (always enrich live). Invalid values fall back to the endpoint default. | `if-recent` |

### Response

| Key         | Description                                                                           | Example                                |
| ----------- | ------------------------------------------------------------------------------------- | -------------------------------------- |
| `blogs`     | List of blog RSS feed URLs (if RSS was discovered) or blog page URLs                  | `["https://stripe.com/blog/feed.rss"]` |
| `x_profile` | X/Twitter profile URL, or `null` if not found                                         | `"https://x.com/stripe"`               |
| `youtube_channels` | List of YouTube channel URLs discovered for the company, or empty if none found | `["https://www.youtube.com/channel/UCdog0Ap82jpFvSnxorxF_lA"]` |
| `updates`   | List of update objects (blog posts, tweets, and YouTube videos mixed), sorted by timestamp descending. | See [Update Object](#update-object)    |
| `timestamp` | UTC timestamp of when this data was pulled                                            | `"2025-03-16T10:00:00+00:00"`          |

### Update Object

| Key           | Description                                                | Example                                     |
| ------------- | ---------------------------------------------------------- | ------------------------------------------- |
| `url`         | URL of the blog post, tweet, or YouTube video              | `"https://stripe.com/blog/example"`         |
| `title`       | Title of the post (first 80 chars for tweets)              | `"Stripe's annual letter"`                  |
| `description` | Post description, tweet text, or video description (up to 500 chars for blogs) | `"A look back at..."`                       |
| `image_url`   | Image URL (tweet media or video thumbnail), or `null`      | `"https://pbs.twimg.com/media/example.jpg"` |
| `timestamp`   | ISO 8601 publication timestamp, or `null` if unknown       | `"2025-03-01T12:00:00+00:00"`               |
| `source`      | Source type of the update                                  | `"blog"`, `"x"`, or `"youtube"`             |

### Response Headers

| Header Key                | Description                             | Example |
| ------------------------- | --------------------------------------- | ------- |
| `X-NinjaPear-Credit-Cost` | Total cost of credits for this API call | `2`     |
| `X-NinjaPear-Cache-Age-Days` | Age of the returned data in whole days. `0` when fresh data is returned from live enrichment. | `1` |

### Error Codes

| Status Code | Charged? | Description                          |
| ----------- | -------- | ------------------------------------ |
| 400         | No       | Missing or invalid website parameter |
| 403         | No       | Insufficient credits                 |
| 404         | No       | No cached data found when `use_cache=if-present-only` |

## Company Funding Endpoint

`GET /api/v1/company/funding`

Cost: `2` credits / request (base) + `1` credit per unique investor returned. The base charge still applies when no funding data is found (see `error_code: "no_funding_data"` below).

Retrieve funding history for a company given its website URL. Returns total funds raised, individual funding rounds with dates and amounts, and participating investors with their websites.

<aside class="warning">
<b>This is a long-running streaming endpoint.</b> The connection is held open while we uncover funding data real time. Typical latency is <b>30 seconds on average</b>, with a hard upper bound of <b>5 minutes</b>. Configure your HTTP client with a read timeout of at least 5 minutes.
</aside>

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --max-time 300 \
  --data-urlencode "website=https://www.stripe.com" \
  "https://nubela.co/api/v1/company/funding"
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

with ninjapear.ApiClient(configuration) as api_client:
    api = ninjapear.CompanyAPIApi(api_client)
    # Set a generous read timeout — calls can take up to 5 minutes.
    response = api.get_company_funding(website="https://www.stripe.com", _request_timeout=300)
    print(response)
```

```javascript
var NinjaPear = require("ninjapear");
var defaultClient = NinjaPear.ApiClient.instance;
defaultClient.authentications["bearerAuth"].accessToken = "YOUR_API_KEY";
defaultClient.timeout = 300000; // 5 minutes

var api = new NinjaPear.CompanyAPIApi();
api.getCompanyFunding("https://www.stripe.com").then(function (data) {
  console.log(data);
});
```

> Example response

```json
{
  "website": "stripe.com",
  "total_funds_raised_usd": 9810000000,
  "credit_cost": 7,
  "funding_rounds": [
    {
      "round_type": "SECONDARY_SALE",
      "date": "2026-02-01",
      "amount_usd": null,
      "investors": [
        {
          "name": "Thrive Capital",
          "website": "thrivecap.com",
          "type": "company",
          "amount_usd": null
        },
        {
          "name": "Coatue",
          "website": "coatue.com",
          "type": "company",
          "amount_usd": null
        },
        {
          "name": "Andreessen Horowitz",
          "website": "a16z.com",
          "type": "company",
          "amount_usd": null
        }
      ]
    },
    {
      "round_type": "SERIES_I",
      "date": "2024-04-01",
      "amount_usd": 694200000,
      "investors": [
        {
          "name": "Sequoia Capital",
          "website": "sequoiacap.com",
          "type": "company",
          "amount_usd": null
        },
        {
          "name": "Brookfield",
          "website": "brookfield.com",
          "type": "company",
          "amount_usd": null
        },
        {
          "name": "Paradigm",
          "website": "paradigm.co",
          "type": "company",
          "amount_usd": null
        }
      ]
    },
    {
      "round_type": "SERIES_I",
      "date": "2023-03-01",
      "amount_usd": 6500000000,
      "investors": [
        {
          "name": "GIC",
          "website": "gic.com.sg",
          "type": "company",
          "amount_usd": null
        },
        {
          "name": "Goldman Sachs",
          "website": "goldmansachs.com",
          "type": "company",
          "amount_usd": null
        },
        {
          "name": "Temasek",
          "website": "temasek.com.sg",
          "type": "company",
          "amount_usd": null
        },
        {
          "name": "Thrive Capital",
          "website": "thrivecap.com",
          "type": "company",
          "amount_usd": null
        }
      ]
    },
    {
      "round_type": "SERIES_H",
      "date": "2021-03-01",
      "amount_usd": 600000000,
      "investors": [
        {
          "name": "Allianz X",
          "website": "allianzx.com",
          "type": "company",
          "amount_usd": null
        },
        {
          "name": "Fidelity",
          "website": "fidelity.com",
          "type": "company",
          "amount_usd": null
        },
        {
          "name": "Baillie Gifford",
          "website": "bailliegifford.com",
          "type": "company",
          "amount_usd": null
        }
      ]
    },
    {
      "round_type": "SEED",
      "date": "2011-03-01",
      "amount_usd": 2000000,
      "investors": [
        {
          "name": "Peter Thiel",
          "website": null,
          "type": "angel",
          "amount_usd": null
        },
        {
          "name": "Sequoia Capital",
          "website": "sequoiacap.com",
          "type": "company",
          "amount_usd": null
        },
        {
          "name": "Elon Musk",
          "website": null,
          "type": "angel",
          "amount_usd": null
        }
      ]
    }
  ]
}
```

### URL Parameters

| Parameter | Required | Description                           | Example                  |
| --------- | -------- | ------------------------------------- | ------------------------ |
| `website` | Yes      | The website URL or company name of the target company. A website URL (e.g. `https://www.stripe.com`) is strongly recommended for precision. | `https://www.stripe.com` |
| `use_cache` | No     | Controls cache usage. Case-insensitive. Values: `if-recent` (default; use cached data when the last scrape is within 29 days, otherwise enrich live), `if-present` (return cache first, enrich live if absent), `if-present-only` (return cache only; return 404 if absent), `never` (always enrich live). Invalid values fall back to the endpoint default. | `if-recent` |

### Response

| Key                      | Description                                                                                                                                                                                                                          | Example        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `website`                | The company domain the response describes, echoed from the request                                                                                                                                                                   | `"stripe.com"` |
| `total_funds_raised_usd` | Total funding raised in USD, or `null` if undisclosed                                                                                                                                                                                | `9810000000`   |
| `funding_rounds`         | Array of FundingRound objects, sorted by date descending                                                                                                                                                                             | See below      |
| `credit_cost`            | Total credits charged for this call (`2` base + `1` per unique investor). Streaming responses deliver the credit cost in the response body rather than the `X-NinjaPear-Credit-Cost` header. | `7`            |

### FundingRound Object

| Key          | Description                                                    | Example        |
| ------------ | -------------------------------------------------------------- | -------------- |
| `round_type` | Type of funding round (see round type values below)            | `"SERIES_A"`   |
| `date`       | Date of the round in `YYYY-MM-DD` format, or `null` if unknown | `"2023-03-01"` |
| `amount_usd` | Amount raised in this round in USD, or `null` if undisclosed   | `600000000`    |
| `investors`  | Array of Investor objects that participated in this round      | See below      |

### Investor Object

| Key          | Description                                                             | Example             |
| ------------ | ----------------------------------------------------------------------- | ------------------- |
| `name`       | Name of the investor (firm or individual)                               | `"Sequoia Capital"` |
| `website`    | Website domain of the investor, or `null` if unknown                    | `"sequoiacap.com"`  |
| `type`       | Either `"company"` (VC firm, fund, corporate) or `"angel"` (individual) | `"company"`         |
| `amount_usd` | Amount this investor contributed in USD, or `null` if undisclosed       | `null`              |

### Round Type Values

`PRE_SEED`, `SEED`, `SERIES_A`, `SERIES_B`, `SERIES_C`, `SERIES_D`, `SERIES_E`, `SERIES_F`, `SERIES_G`, `SERIES_H`, `SERIES_I` through `SERIES_Z`, `BRIDGE`, `VENTURE_DEBT`, `CONVERTIBLE_NOTE`, `GRANT`, `SECONDARY_SALE`, `PRIVATE_EQUITY`, `GROWTH_EQUITY`, `IPO`, `POST_IPO_EQUITY`, `POST_IPO_DEBT`, `DEBT_FINANCING`, `CROWDFUNDING`, `CORPORATE_ROUND`, `UNKNOWN`

### Response Headers

This endpoint streams its response; HTTP trailers are not supported, so the credit cost is delivered in the response body (the `credit_cost` field) rather than the `X-NinjaPear-Credit-Cost` header. When the response is served from cache, the `X-NinjaPear-Credit-Cost` header is returned as normal.
The `X-NinjaPear-Cache-Age-Days` header is returned on successful responses for all `use_cache` modes; fresh live enrichment returns `0`.

| Header Key                | Description                                                                           | Example |
| ------------------------- | ------------------------------------------------------------------------------------- | ------- |
| `X-NinjaPear-Credit-Cost` | Total cost of credits for this API call (2 base + 1 per investor). **Cache hits only.** | `7`     |
| `X-NinjaPear-Cache-Age-Days` | Age of the returned data in whole days. `0` when fresh data is returned from live enrichment. | `12` |

### Error Codes

Client-side errors (HTTP 400 / 403) are returned before the streaming body begins. On cache misses, server-side errors are delivered as **HTTP 200 with `error` and `error_code` fields in the response body** — because the streaming connection has already been established, the status code cannot be changed. Clients that previously branched on `response.status_code == 404` should branch on the `error_code` field instead.

| Status Code                        | Charged?        | `error_code` (body) | Description                                                                                           |
| ---------------------------------- | --------------- | ------------------- | ----------------------------------------------------------------------------------------------------- |
| 400                                | No              | —                   | Missing or invalid website parameter                                                                  |
| 403                                | No              | —                   | Insufficient credits                                                                                  |
| 404                                | No              | —                   | No cached data found when `use_cache=if-present-only`                                                  |
| 200 (body carries error)           | Yes (2 credits) | `no_funding_data`   | No funding data could be found for the given website. `funding_rounds` is `[]`.                       |
| 200 (body carries error)           | No              | `service_temp_unavailable` | Service temporarily unavailable. Retry later. `funding_rounds` is `[]`.                        |

## Website Lookup Endpoint

`GET /api/v1/company/website`

Cost: `1` credit / request (charged whether or not a match is found).

Resolve a company's name to its canonical website URL.

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --data-urlencode "company_name=Apex" \
  --data-urlencode "country_code=us" \
  --data-urlencode "hint=cybersecurity firm" \
  "https://nubela.co/api/v1/company/website"
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

with ninjapear.ApiClient(configuration) as api_client:
    api = ninjapear.CompanyAPIApi(api_client)
    response = api.get_website_lookup(
        company_name="Apex",
        country_code="us",
        hint="cybersecurity firm",
    )
    print(response)
```

```javascript
var NinjaPear = require("ninjapear");
var defaultClient = NinjaPear.ApiClient.instance;
defaultClient.authentications["bearerAuth"].accessToken = "YOUR_API_KEY";

var api = new NinjaPear.CompanyAPIApi();
api.getWebsiteLookup("Apex", {
  countryCode: "us",
  hint: "cybersecurity firm",
}).then(function (data) {
  console.log(data);
});
```

> Example response:

```json
{
  "website": "https://www.apexsecurity.com"
}
```

### URL Parameters

| Parameter      | Required | Description                                                                                                                                                                                                                                          | Example                |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------|
| `company_name` | Yes      | The name of the company to look up.                                                                                                                                                                                                                  | `Apex`                 |
| `country_code` | No       | Optional ISO 3166-1 alpha-2 2-letter country code used to bias the search geographically (e.g. `us`, `gb`, `de`, `sg`). See the [full list of ISO 3166-1 alpha-2 codes](https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes/blob/master/all/all.csv). Defaults to `us` when omitted. | `us`                   |
| `hint`         | No       | Provide a hint to differentiate similarly named companies in the same country.                                                                                                                                                                       | `cybersecurity firm`   |

### Response

| Key       | Description                                   | Example                   |
| --------- | --------------------------------------------- | ------------------------- |
| `website` | The resolved canonical website URL.           | `https://www.stripe.com`  |

### Response Headers

| Header Key                | Description                             | Example |
| ------------------------- | --------------------------------------- | ------- |
| `X-NinjaPear-Credit-Cost` | Total cost of credits for this API call | `1`     |

### Error Codes

| Status Code | Charged?    | Description                                                  |
| ----------- | ----------- | ------------------------------------------------------------ |
| 400         | No          | Missing or invalid `company_name` parameter.                 |
| 400         | No          | Invalid `country_code` (not a recognised 2-letter code).     |
| 404         | Yes (1)     | No website match could be found for the given company name. |

# Employee API

## Work Email Endpoint

`GET /api/v1/employee/work-email`

Cost: `2` credits on a successful lookup (work email found). When no email is found (`work_email` is `null`), a token charge of `0.5` credits is applied — this discourages abuse while keeping speculative lookups inexpensive.

Makes a best-effort attempt to return a public work email of a person given their first name (optional last name) and a company domain.

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --data-urlencode "first_name=Patrick" \
  --data-urlencode "last_name=Collison" \
  --data-urlencode "domain=stripe.com" \
  "https://nubela.co/api/v1/employee/work-email"
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

with ninjapear.ApiClient(configuration) as api_client:
    api = ninjapear.EmployeeAPIApi(api_client)
    result = api.find_work_email(
        first_name="Patrick",
        last_name="Collison",
        domain="stripe.com",
    )
    print(result)
```

```javascript
var NinjaPear = require("ninjapear");
var defaultClient = NinjaPear.ApiClient.instance;
defaultClient.authentications["bearerAuth"].accessToken = "YOUR_API_KEY";

var api = new NinjaPear.EmployeeAPIApi();
api
  .findWorkEmail({
    firstName: "Patrick",
    lastName: "Collison",
    domain: "stripe.com",
  })
  .then(function (data) {
    console.log(data);
  });
```

> Example response (email found)

```json
{
  "work_email": "patrick@stripe.com"
}
```

> Example response (no evidence)

```json
{
  "work_email": null
}
```

### URL Parameters

| Parameter    | Required | Description                                                      | Example      |
| ------------ | -------- | ---------------------------------------------------------------- | ------------ |
| `first_name` | Yes      | Person's first name.                                             | `Patrick`    |
| `last_name`  | No       | Person's last name. Improves accuracy when the pattern needs it. | `Collison`   |
| `domain`     | Yes      | Company domain. Protocol and path are stripped if present.       | `stripe.com` |

### Response

| Key          | Description                                                                                           | Example                          |
| ------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------- |
| `work_email` | Best-effort work email address. `null` if no public email was found AND no pattern could be inferred. | `"patrick@stripe.com"` \| `null` |

### Response Headers

| Header Key                | Description                                                                                   | Example      |
| ------------------------- | --------------------------------------------------------------------------------------------- | ------------ |
| `X-NinjaPear-Credit-Cost` | Total credits charged for this call. `2` on a hit; `0.5` on a miss (token anti-abuse charge). | `2` or `0.5` |

### Error Codes

| Status Code | Charged? | Description                                   |
| ----------- | -------- | --------------------------------------------- |
| 400         | No       | Missing or invalid `first_name` / `domain`.   |
| 403         | No       | Insufficient credits.                         |
| 503         | No       | Service temporarily unavailable. Retry later. |

## Person Profile Endpoint

`GET /api/v2/employee/profile`

![Fast avg 8.0s](https://img.shields.io/badge/Fast%20avg-8.0s-16a34a)
![Detailed avg 12.3s](https://img.shields.io/badge/Detailed%20avg-12.3s-2563eb)

Cost: `3` credits / request. Credits are charged even if no data is found.

Enrich an employee's professional profile given a work email address, a name and employer combination, or a role and employer combination. Returns structured profile data including work history, education, location, and social media presence.

You must provide at least one of these input combinations:

- **Work email only** — e.g. `work_email=john@stripe.com`
- **First name + employer website** — e.g. `first_name=John&employer_website=https://stripe.com`
- **Employer website + role** — e.g. `employer_website=https://stripe.com&role=CTO`

You can always add more parameters to improve accuracy. For example, providing `work_email` together with `first_name`, `last_name`, and `role` will yield better results than `work_email` alone.

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --data-urlencode "work_email=john@stripe.com" \
  "https://nubela.co/api/v2/employee/profile"
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

with ninjapear.ApiClient(configuration) as api_client:
    api = ninjapear.EmployeeAPIApi(api_client)
    profile = api.get_person_profile_v2(work_email="john@stripe.com")
    print(profile)
```

```javascript
var NinjaPear = require("ninjapear");
var defaultClient = NinjaPear.ApiClient.instance;
defaultClient.authentications["bearerAuth"].accessToken = "YOUR_API_KEY";

var api = new NinjaPear.EmployeeAPIApi();
api.getPersonProfileV2({ workEmail: "john@stripe.com" }).then(function (data) {
  console.log(data);
});
```

> Example response

```json
{
  "id": "abc123de-f456-7890-abcd-ef1234567890",
  "slug": "elon-musk",
  "profile_pic_url": "https://pbs.twimg.com/profile_images/1234567890/photo_400x400.jpg",
  "first_name": "Elon",
  "middle_name": "Reeve",
  "last_name": "Musk",
  "full_name": "Elon Reeve Musk",
  "bio": "Mars & Cars, Chips & Dips",
  "follower_count": 195000000,
  "following_count": 782,
  "country": "US",
  "city": "USAUS",
  "state": "US-TX",
  "x_handle": "elonmusk",
  "x_profile_url": "https://x.com/elonmusk",
  "personal_website": "https://elonmusk.com",
  "work_experience": [
    {
      "role": "CEO",
      "company_name": "Tesla",
      "company_website": "tesla.com",
      "description": "Leading Tesla's mission to accelerate the world's transition to sustainable energy.",
      "start_date": "2008-10",
      "end_date": null
    },
    {
      "role": "CEO and CTO",
      "company_name": "SpaceX",
      "company_website": "spacex.com",
      "description": "Founded SpaceX with the goal of reducing space transportation costs and enabling the colonization of Mars.",
      "start_date": "2002-05",
      "end_date": null
    },
    {
      "role": "Co-founder",
      "company_name": "PayPal",
      "company_website": "paypal.com",
      "description": null,
      "start_date": "1999-01",
      "end_date": "2002-10"
    }
  ],
  "education": [
    {
      "major": "B.S. Economics",
      "school": "Wharton School, University of Pennsylvania",
      "start_date": "1992-01",
      "end_date": "1997-01"
    },
    {
      "major": "B.S. Physics",
      "school": "University of Pennsylvania",
      "start_date": "1992-01",
      "end_date": "1997-01"
    }
  ],
  "work_email_lookup": "https://nubela.co/api/v1/employee/work-email?first_name=Elon&last_name=Musk&domain=tesla.com",
  "similar_people": "https://nubela.co/api/v1/employee/similar?id=abc123de-f456-7890-abcd-ef1234567890"
}
```

### URL Parameters

| Parameter          | Required    | Description                                                                                        | Example              |
| ------------------ | ----------- | -------------------------------------------------------------------------------------------------- | -------------------- |
| `work_email`       | Conditional | Work email address of the person. Required if `employer_website` is not provided.                  | `john@stripe.com`    |
| `first_name`       | Conditional | Person's first name. Required when using name + `employer_website` combination.                    | `John`               |
| `middle_name`      | No          | Person's middle name. Improves accuracy when combined with other parameters.                       | `Michael`            |
| `last_name`        | No          | Person's last name. Improves accuracy when combined with other parameters.                         | `Smith`              |
| `employer_website` | Conditional | Website URL or company name of the person's employer. A website URL is strongly recommended for precision. Required if `work_email` is not provided. | `https://stripe.com` |
| `role`             | No          | Current job title or role. Improves accuracy. Required when using `employer_website` without name. | `CTO`                |
| `slug`             | No          | Person slug for a direct lookup of an existing enriched profile.                                    | `elon-musk`          |
| `id`               | No          | Person ID for a direct lookup of an existing enriched profile.                                      | `abc123de-...`       |
| `enrichment`       | No          | Controls live enrichment depth. Values: `detailed` (default; waits for detailed enrichment before returning), `fast` (returns quickly and starts detailed enrichment in the background).<br><br>A fast response includes less biographical detail, such as website and profile picture data, but quickly returns structured work and education history.<br><br>A fast enrichment request also starts detailed enrichment in the background, and you are entitled to that result as well. Poll the same request with the same parameters and `use_cache=if-recent` 10 to 30 seconds later to retrieve the fully enriched result at no additional cost. Stop polling when the `X-NinjaPear-Enrichment-Status` response header is `complete`. Once detailed enrichment finishes, the same request returns the detailed cached profile at no additional cost.<br><br>Use `enrichment=detailed` when you need the full response and do not mind waiting. Use `enrichment=fast` when you need a quick result for use cases such as populating a UI. | `detailed`           |
| `use_cache`        | No          | Controls cache usage. Case-insensitive. Values: `if-recent` (default; use cached data when the last scrape is within 29 days, otherwise enrich live), `if-present` (return cache first, enrich live if absent), `if-present-only` (return cache only; return 404 if absent), `never` (always enrich live). Invalid values fall back to the endpoint default. | `if-recent`          |

### Valid Input Combinations

| Combination                       | Example                                                |
| --------------------------------- | ------------------------------------------------------ |
| `work_email` alone                | `?work_email=john@stripe.com`                          |
| `first_name` + `employer_website` | `?first_name=John&employer_website=https://stripe.com` |
| `employer_website` + `role`       | `?employer_website=https://stripe.com&role=CTO`        |
| `slug` or `id`                    | `?slug=elon-musk`                                      |

Additional parameters can always be included to improve result accuracy.

### Response

| Key                 | Description                                                                                                                                                                                                                                                                                                                                                                                          | Example                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `id`                | Unique person ID. Present when the profile is backed by a persisted person record.                                                                                                                                                                                                                                                                                                                    | `"abc123de-f456-7890-abcd-ef1234567890"`                                                        |
| `slug`              | Unique person slug. Present when the profile is backed by a persisted person record.                                                                                                                                                                                                                                                                                                                  | `"elon-musk"`                                                                                    |
| `profile_pic_url`   | URL to the person's profile picture (from X/Twitter). May be `null`.                                                                                                                                                                                                                                                                                                                                 | `"https://pbs.twimg.com/.../photo_400x400.jpg"`                                                  |
| `first_name`        | First name                                                                                                                                                                                                                                                                                                                                                                                           | `"Elon"`                                                                                         |
| `middle_name`       | Middle name. May be `null`.                                                                                                                                                                                                                                                                                                                                                                          | `"Reeve"`                                                                                        |
| `last_name`         | Last name                                                                                                                                                                                                                                                                                                                                                                                            | `"Musk"`                                                                                         |
| `full_name`         | Full name                                                                                                                                                                                                                                                                                                                                                                                            | `"Elon Reeve Musk"`                                                                              |
| `bio`               | Bio/description from X/Twitter profile. May be `null`.                                                                                                                                                                                                                                                                                                                                               | `"Mars & Cars, Chips & Dips"`                                                                    |
| `follower_count`    | Number of X/Twitter followers. May be `null`.                                                                                                                                                                                                                                                                                                                                                        | `195000000`                                                                                      |
| `following_count`   | Number of X/Twitter accounts followed. May be `null`.                                                                                                                                                                                                                                                                                                                                                | `782`                                                                                            |
| `country`           | Country of residence. ISO 3166-1 alpha-2 code.                                                                                                                                                                                                                                                                                                                                                       | `"US"`                                                                                           |
| `city`              | City of residence. UN/LOCODE.                                                                                                                                                                                                                                                                                                                                                                        | `"USAUS"`                                                                                        |
| `state`             | State or region of residence. ISO 3166-2 subdivision code.                                                                                                                                                                                                                                                                                                                                           | `"US-TX"`                                                                                        |
| `x_handle`          | X/Twitter handle (without @). May be `null`.                                                                                                                                                                                                                                                                                                                                                         | `"elonmusk"`                                                                                     |
| `x_profile_url`     | URL to X/Twitter profile. May be `null`.                                                                                                                                                                                                                                                                                                                                                             | `"https://x.com/elonmusk"`                                                                       |
| `personal_website`  | Personal website URL. May be `null`.                                                                                                                                                                                                                                                                                                                                                                 | `"https://elonmusk.com"`                                                                         |
| `work_experience`   | List of work history entries, most recent first                                                                                                                                                                                                                                                                                                                                                      | \[[WorkExperience Object](#workexperience-object)\]                                              |
| `education`         | List of education entries, most recent first                                                                                                                                                                                                                                                                                                                                                         | \[[Education Object](#education-object)\]                                                        |
| `work_email_lookup` | Pre-built URL to the [Work Email Endpoint](#work-email-endpoint) for this person, with `first_name`, `last_name`, and `domain` (the website of the most recent work experience) already populated. Call it directly with your bearer token to resolve the person's work email — no need to re-pass params. Costs `2` credits per call. May be `null` when the current employer's website is unknown. | `"https://nubela.co/api/v1/employee/work-email?first_name=Elon&last_name=Musk&domain=tesla.com"` |
| `similar_people`    | Pre-built URL to the [Similar People Endpoint](#similar-people-endpoint) for this person, keyed by their `id`. Call it directly to fetch people with the same role at competing companies — no need to re-pass search params.                                                                                                                                                                        | `"https://nubela.co/api/v1/employee/similar?id=abc123de-..."`                                    |

### WorkExperience Object

| Key               | Description                                                      | Example                        |
| ----------------- | ---------------------------------------------------------------- | ------------------------------ |
| `role`            | Job title or role                                                | `"CEO"`                        |
| `company_name`    | Name of the company                                              | `"Tesla"`                      |
| `company_website` | Company website domain. May be `null`.                           | `"tesla.com"`                  |
| `description`     | Description of what the person did in this role. May be `null`.  | `"Leading Tesla's mission..."` |
| `start_date`      | Start date in YYYY-MM format. May be `null`.                     | `"2008-10"`                    |
| `end_date`        | End date in YYYY-MM format. `null` means currently in this role. | `null`                         |

### Education Object

| Key          | Description                                  | Example                                        |
| ------------ | -------------------------------------------- | ---------------------------------------------- |
| `major`      | Degree and field of study                    | `"B.S. Economics"`                             |
| `school`     | School or university name                    | `"Wharton School, University of Pennsylvania"` |
| `start_date` | Start date in YYYY-MM format. May be `null`. | `"1992-01"`                                    |
| `end_date`   | End date in YYYY-MM format. May be `null`.   | `"1997-01"`                                    |

### Response Headers

| Header Key                | Description                             | Example |
| ------------------------- | --------------------------------------- | ------- |
| `X-NinjaPear-Credit-Cost` | Total cost of credits for this API call | `3`     |
| `X-NinjaPear-Cache-Age-Days` | Age of the returned data in whole days. `0` when fresh data is returned from live enrichment. | `12` |
| `X-NinjaPear-Enrichment-Status` | Detailed enrichment status for v2 Person Profile responses. `pending` means the response is the fast profile and detailed enrichment is still running or waiting to finish. `complete` means the response is the detailed cached profile or a detailed enrichment result. For `enrichment=fast`, poll until this header is `complete`. | `complete` |

### Error Codes

| Status Code | Charged?        | Description                                                                                                     |
| ----------- | --------------- | --------------------------------------------------------------------------------------------------------------- |
| 400         | No              | Invalid input. Must provide `work_email`, or `first_name` + `employer_website`, or `employer_website` + `role`. |
| 400         | No              | Invalid `enrichment`. Use `fast` or `detailed`. The deprecated `speed` parameter is not accepted.                |
| 400         | No              | `work_email` is a personal/free email (e.g. `john@gmail.com`). Provide a corporate work email.                  |
| 403         | No              | Insufficient credits                                                                                            |
| 404         | No              | `work_email` is a role-based / generic mailbox (e.g. `info@`, `support@`, `sales@`, `noreply@`) that does not map to an individual person. |
| 404         | No              | No cached data found when `use_cache=if-present-only`                                                          |
| 404         | Yes (3 credits) | No profile data could be found for the given input                                                              |
| 503         | No              | Service temporarily unavailable. Retry later.                                                                   |

## Similar People Endpoint

`GET /api/v1/employee/similar`

Cost: `10` credits base + `5` credits per (company, role) tuple attempted. The base cost is charged regardless of whether any similar people are found, because the endpoint expends real-time enrichment resources to fulfil every request. Cached results are free (see below).

Find people who are _similar_ to a target person — defined as people holding the **same role at competing companies**. Given a target (e.g. the CEO of `nubela.co`), the endpoint identifies the target's current employer, looks up that employer's competitors, and attempts to enrich the same-role person at each competitor in real time. The response returns the target's profile, the list of (company, role) tuples we attempted to search, and the similar people we successfully enriched.

<aside class="warning">
<b>This is a long-running streaming endpoint.</b> The connection is held open while we uncover and enrich competitor profiles in real time. Typical latency is <b>1–3 minutes on average</b>, with a hard upper bound of <b>5 minutes</b>. The more similar people we return, the longer the call takes. Configure your HTTP client with a read timeout of at least 5 minutes.
</aside>

<aside class="notice">
<b>Cached results are free.</b> Results are cached per target person. A repeat query by the same user for the same target is served instantly from cache and costs <b>0 credits</b> (no base fee, no per-tuple fee).
</aside>

Inputs are identical to the [Person Profile Endpoint](#person-profile-endpoint). You must provide at least one of these input combinations:

- **Work email only** — e.g. `work_email=tim@apple.com`
- **First name + employer website** — e.g. `first_name=Tim&employer_website=https://apple.com`
- **Employer website + role** — e.g. `employer_website=https://apple.com&role=CEO`

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --max-time 300 \
  --data-urlencode "work_email=tim@apple.com" \
  "https://nubela.co/api/v1/employee/similar"
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

with ninjapear.ApiClient(configuration) as api_client:
    api = ninjapear.EmployeeAPIApi(api_client)
    # Set a generous read timeout — calls can take up to 5 minutes.
    result = api.get_similar_people(work_email="tim@apple.com", _request_timeout=300)
    print(result)
```

```javascript
var NinjaPear = require("ninjapear");
var defaultClient = NinjaPear.ApiClient.instance;
defaultClient.authentications["bearerAuth"].accessToken = "YOUR_API_KEY";
defaultClient.timeout = 300000; // 5 minutes

var api = new NinjaPear.EmployeeAPIApi();
api.getSimilarPeople({ workEmail: "tim@apple.com" }).then(function (data) {
  console.log(data);
});
```

> Example response

```json
{
  "target": {
    "first_name": "Tim",
    "last_name": "Cook",
    "full_name": "Tim Cook",
    "work_experience": [
      {
        "role": "CEO",
        "company_name": "Apple",
        "company_website": "apple.com",
        "start_date": "2011-08",
        "end_date": null
      }
    ]
  },
  "attempted_searches": [
    { "employer_website": "samsung.com", "role": "CEO" },
    { "employer_website": "google.com", "role": "CEO" },
    { "employer_website": "microsoft.com", "role": "CEO" },
    { "employer_website": "huawei.com", "role": "CEO" }
  ],
  "similar_people": [
    {
      "first_name": "Sundar",
      "last_name": "Pichai",
      "full_name": "Sundar Pichai",
      "work_experience": [
        {
          "role": "CEO",
          "company_name": "Google",
          "company_website": "google.com",
          "start_date": "2015-08",
          "end_date": null
        }
      ]
    },
    {
      "first_name": "Satya",
      "last_name": "Nadella",
      "full_name": "Satya Nadella",
      "work_experience": [
        {
          "role": "CEO",
          "company_name": "Microsoft",
          "company_website": "microsoft.com",
          "start_date": "2014-02",
          "end_date": null
        }
      ]
    }
  ],
  "credit_cost": 30
}
```

For brevity the example above shows only a subset of `PersonProfile` fields. Each entry under `target` and `similar_people` is a full `PersonProfile` object - see the [Person Profile Endpoint Response](#response-3) for the complete schema, including `profile_pic_url`, `bio`, `country`, `x_handle`, `education`, etc.

### URL Parameters

Identical to the [Person Profile Endpoint URL Parameters](#url-parameters-7).

| Parameter          | Required    | Description                                                                              | Example             |
| ------------------ | ----------- | ---------------------------------------------------------------------------------------- | ------------------- |
| `work_email`       | Conditional | Work email address of the target person. Required if `employer_website` is not provided. | `tim@apple.com`     |
| `first_name`       | Conditional | Target's first name. Required when using name + `employer_website` combination.          | `Tim`               |
| `middle_name`      | No          | Target's middle name. Improves accuracy when combined with other parameters.             | `Donald`            |
| `last_name`        | No          | Target's last name. Improves accuracy when combined with other parameters.               | `Cook`              |
| `employer_website` | Conditional | Website URL or company name of the target's employer. A website URL is strongly recommended for precision. Required if `work_email` is not provided. | `https://apple.com` |
| `role`             | No          | Current job title or role. Required when using `employer_website` without name.          | `CEO`               |

### Valid Input Combinations

| Combination                       | Example                                              |
| --------------------------------- | ---------------------------------------------------- |
| `work_email` alone                | `?work_email=tim@apple.com`                          |
| `first_name` + `employer_website` | `?first_name=Tim&employer_website=https://apple.com` |
| `employer_website` + `role`       | `?employer_website=https://apple.com&role=CEO`       |

### Response

| Key                  | Description                                                                                                                                                                                                                                                          | Example                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `target`             | The resolved target person's full profile. Same schema as the [Person Profile Endpoint](#person-profile-endpoint).                                                                                                                                                   | `{ "first_name": "Tim", ... }`                        |
| `attempted_searches` | List of (company, role) tuples we attempted to enrich. One entry per competitor of the target's current employer. Drives the per-tuple billing (5 credits each).                                                                                                     | \[[AttemptedSearch Object](#attemptedsearch-object)\] |
| `similar_people`     | List of successfully enriched profiles for people matching the same role at competing companies. May be a subset of `attempted_searches` (some attempts return no data). Each entry uses the same schema as the [Person Profile Endpoint](#person-profile-endpoint). | \[PersonProfile, ...\]                                |
| `credit_cost`        | Total credits charged for this call. Equal to `10 + 5 * len(attempted_searches)`, or `0` for cached results served to the same product that previously paid.                                                                                                         | `30`                                                  |

### AttemptedSearch Object

| Key                | Description                                               | Example        |
| ------------------ | --------------------------------------------------------- | -------------- |
| `employer_website` | Competitor company website domain that we attempted.      | `"google.com"` |
| `role`             | Role we searched for at that competitor (mirrors target). | `"CEO"`        |

### Response Headers

This endpoint streams its response, so the credit cost cannot be returned in a header — HTTP trailers aren't supported by the streaming layer. Read the `credit_cost` field on the response body instead of the usual `X-NinjaPear-Credit-Cost` header.

### Error Codes

| Status Code | Charged? | Description                                                                                                     |
| ----------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| 400         | No       | Invalid input. Must provide `work_email`, or `first_name` + `employer_website`, or `employer_website` + `role`. |
| 400         | No       | `work_email` is a personal/free email (e.g. `john@gmail.com`). Provide a corporate work email.                  |
| 403         | No       | Insufficient credits. You need at least 10 credits to start a similar-people search.                            |
| 404         | No       | `work_email` is a role-based / generic mailbox (e.g. `info@`, `support@`, `sales@`, `noreply@`) that does not map to an individual person. |
| 404         | No       | Target person could not be resolved.                                                                            |
| 503         | No       | Resource temporarily unavailable. Please try again.                                                             |

## Employee Search Endpoint

`GET /api/v1/employee/search`

Cost: base `2` credits per call (charged even when no employees are returned), plus `1` credit per employee in the `employees` array. A query that returns 10 employees costs `2 + 10 = 12` credits.

Find current employees of a company filtered by role, optionally narrowed by geography.

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --data-urlencode "company_website=stripe.com" \
  --data-urlencode "role=VP of Engineering" \
  "https://nubela.co/api/v1/employee/search"
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

with ninjapear.ApiClient(configuration) as api_client:
    api = ninjapear.EmployeeAPIApi(api_client)
    result = api.search_employees(
        company_website="stripe.com",
        role="VP of Engineering",
    )
    print(result)
```

```javascript
var NinjaPear = require("ninjapear");
var defaultClient = NinjaPear.ApiClient.instance;
defaultClient.authentications["bearerAuth"].accessToken = "YOUR_API_KEY";

var api = new NinjaPear.EmployeeAPIApi();
api.searchEmployees({
  companyWebsite: "stripe.com",
  role: "VP of Engineering",
}).then(function (data) {
  console.log(data);
});
```

> Example response

```json
{
  "employees": [
    {
      "first_name": "Jane",
      "last_name": "Doe",
      "role": "VP of Engineering",
      "company_website": "stripe.com",
      "company_details": "https://nubela.co/api/v1/company/details?website=stripe.com",
      "person_profile": "https://nubela.co/api/v2/employee/profile?first_name=Jane&last_name=Doe&employer_website=https%3A%2F%2Fstripe.com",
      "work_email": "https://nubela.co/api/v1/employee/work-email?first_name=Jane&last_name=Doe&domain=stripe.com"
    },
    {
      "first_name": "John",
      "last_name": "Smith",
      "role": "Director of Engineering",
      "company_website": "stripe.com",
      "company_details": "https://nubela.co/api/v1/company/details?website=stripe.com",
      "person_profile": "https://nubela.co/api/v2/employee/profile?first_name=John&last_name=Smith&employer_website=https%3A%2F%2Fstripe.com",
      "work_email": "https://nubela.co/api/v1/employee/work-email?first_name=John&last_name=Smith&domain=stripe.com"
    }
  ]
}
```

### URL Parameters

| Parameter         | Required | Description                                                                                                                                                                                                                                                                                                                | Example             |
| ----------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `company_website` | Yes      | The target company. Preferred form is a website (bare domain like `stripe.com` or full URL like `https://stripe.com`). A company name (e.g. `Stripe`) is also accepted. | `stripe.com`        |
| `role`            | Yes      | Job role to narrow the search. Matches related role variants (e.g. `VP of Engineering` also matches `Vice President, Engineering`).                                                                                                                                                                                       | `VP of Engineering` |
| `country`         | No       | ISO 3166-1 alpha-2 country code to constrain by.                                                                                                                                                                                                                                                                          | `US`                |
| `state`           | No       | State or region to constrain by (freeform).                                                                                                                                                                                                                                                                               | `California`        |
| `city`            | No       | City to constrain by (freeform).                                                                                                                                                                                                                                                                                          | `San Francisco`     |
| `use_cache`       | No       | Controls cache usage. Case-insensitive. Values: `if-recent` (default; use cached data when the last scrape is within 29 days, otherwise enrich live), `if-present` (return cache first, enrich live if absent), `if-present-only` (return cache only; return 404 if absent), `never` (always enrich live). Invalid values fall back to the endpoint default. | `if-recent`         |

### Response

| Key         | Description                                                                       | Example                                  |
| ----------- | --------------------------------------------------------------------------------- | ---------------------------------------- |
| `employees` | List of matching employees at the target company. Empty array if none are found. | \[[Employee Object](#employee-object)\] |

### Employee Object

| Key               | Description                                                                                                                                                                                                                                                          | Example                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `first_name`      | The employee's first name.                                                                                                                                                                                                                                           | `"Jane"`                                                                                                             |
| `last_name`       | The employee's last name. May be `null` if unavailable.                                                                                                                                                                                                              | `"Doe"`                                                                                                              |
| `role`            | The employee's current job title at the target company.                                                                                                                                                                                                              | `"VP of Engineering"`                                                                                                |
| `company_website` | Website of the target employer the employee works at. Mirrors the resolved `company_website` input parameter on every record.                                                                                                                                       | `"stripe.com"`                                                                                                       |
| `company_details` | Prefilled URL to the [Company Details Endpoint](#company-details-endpoint), populated with `website`. Authenticate with your bearer token to retrieve company details.                                                                                              | `"https://nubela.co/api/v1/company/details?website=stripe.com"`                                                      |
| `person_profile`  | Prefilled URL to the [Person Profile Endpoint](#person-profile-endpoint), populated with `first_name`, `last_name`, and `employer_website`. Call directly with your bearer token to enrich the person. Costs `3` credits per call. | `"https://nubela.co/api/v2/employee/profile?first_name=Jane&last_name=Doe&employer_website=https%3A%2F%2Fstripe.com"` |
| `work_email`      | Prefilled URL to the [Work Email Endpoint](#work-email-endpoint), populated with `first_name`, `last_name`, and `domain`. Call directly with your bearer token to resolve the work email. Costs `2` credits on a hit, `0.5` credits when no email is found.         | `"https://nubela.co/api/v1/employee/work-email?first_name=Jane&last_name=Doe&domain=stripe.com"`                     |

### Response Headers

| Header Key                | Description                                                                                                                          | Example |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `X-NinjaPear-Credit-Cost` | Total credits charged for this call. Equals `2 + N` where `N` is the number of employees returned (`2` when the array is empty).   | `12`    |
| `X-NinjaPear-Cache-Age-Days` | Age of the returned data in whole days. `0` when fresh data is returned from live enrichment. | `12` |

### Error Codes

| Status Code | Charged? | Description                                                                       |
| ----------- | -------- | --------------------------------------------------------------------------------- |
| 400         | No       | Missing or invalid `company_website` or `role` parameter.                          |
| 403         | No       | Insufficient credits. You need at least `2` credits to start a search.             |
| 404         | No       | No cached data found when `use_cache=if-present-only`                              |
| 404         | No       | The provided `company_website` could not be resolved to a known company.           |
| 503         | No       | Resource temporarily unavailable. Please try again.                               |

# Meta API

## View Credit Balance Endpoint

`GET /api/v1/meta/credit-balance`

Cost: `0` credit / successful request.

Get your current credit balance.

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  "https://nubela.co/api/v1/meta/credit-balance"
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

with ninjapear.ApiClient(configuration) as api_client:
    api = ninjapear.MetaAPIApi(api_client)
    response = api.get_credit_balance()
    print(response)
```

```javascript
var NinjaPear = require("ninjapear");
var defaultClient = NinjaPear.ApiClient.instance;
defaultClient.authentications["bearerAuth"].accessToken = "YOUR_API_KEY";

var api = new NinjaPear.MetaAPIApi();
api.getCreditBalance().then(function (data) {
  console.log(data);
});
```

> Example response:

```json
{
  "credit_balance": 100000
}
```

### Response

| Key              | Description                 | Example  |
| ---------------- | --------------------------- | -------- |
| `credit_balance` | Your current credit balance | `100000` |

### Response Headers

| Header Key                | Description                             | Example |
| ------------------------- | --------------------------------------- | ------- |
| `X-NinjaPear-Credit-Cost` | Total cost of credits for this API call | `0`     |

### Error Codes

| Status Code | Charged? | Description     |
| ----------- | -------- | --------------- |
| 401         | No       | Invalid API key |

# Contact API

## Disposable Email Checker Endpoint

`GET /api/v1/contact/disposable-email`

Cost: `0` credit / successful request. (FREE)

Check if an email address is a disposable (temporary/throwaway) email or a free email provider.

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --data-urlencode "email=test@mailinator.com" \
  "https://nubela.co/api/v1/contact/disposable-email"
```

```python
import ninjapear

configuration = ninjapear.Configuration(
    host="https://nubela.co",
    access_token="YOUR_API_KEY"
)

with ninjapear.ApiClient(configuration) as api_client:
    api = ninjapear.ContactAPIApi(api_client)
    response = api.check_disposable_email(email="test@mailinator.com")
    print(response)
```

```javascript
var NinjaPear = require("ninjapear");
var defaultClient = NinjaPear.ApiClient.instance;
defaultClient.authentications["bearerAuth"].accessToken = "YOUR_API_KEY";

var api = new NinjaPear.ContactAPIApi();
api.checkDisposableEmail("test@mailinator.com").then(function (data) {
  console.log(data);
});
```

> Example response:

```json
{
  "email": "test@mailinator.com",
  "is_disposable_email": true,
  "is_free_email": false
}
```

### URL Parameters

| Parameter | Required | Description                | Example               |
| --------- | -------- | -------------------------- | --------------------- |
| `email`   | Yes      | The email address to check | `test@mailinator.com` |

### Response

| Key                   | Description                                                                    | Example                 |
| --------------------- | ------------------------------------------------------------------------------ | ----------------------- |
| `email`               | The email address that was checked                                             | `"test@mailinator.com"` |
| `is_disposable_email` | Whether the email domain is a known disposable/temporary email provider        | `true`                  |
| `is_free_email`       | Whether the email domain is a free email provider (e.g., gmail.com, yahoo.com) | `false`                 |

### Response Headers

| Header Key                | Description                             | Example |
| ------------------------- | --------------------------------------- | ------- |
| `X-NinjaPear-Credit-Cost` | Total cost of credits for this API call | `0`     |

### Error Codes

| Status Code | Charged? | Description          |
| ----------- | -------- | -------------------- |
| 400         | No       | Invalid email format |

# Monitor API

The Monitor API allows you to monitor updates of companies. Every new update is compiled into a single RSS feed. The system monitors company blogs, X (Twitter) profiles, and website changes.

## Core Concepts

- **Feed:** The parent container. A feed can be public or private. Private feeds require a bearer token passed via the URL query string to ensure compatibility with standard RSS readers.
- **Target:** A specific company/website being monitored within a feed.
- **Settings:** Granular preferences per target dictating what to monitor (Blog, X, Website) and how often.

## How To Use

Suppose you want to monitor a group of competitor websites for blog posts, X activity, and website changes — all delivered as a single RSS feed you can plug into Feedly, Slack, Zapier, or any RSS reader.

**1. Create a feed with targets** — group the companies you want to monitor into a feed. Each company is a **target** identified by its website URL.

<div class="inline-code">curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SaaS Competitors",
    "targets": [
      { "website_url": "https://stripe.com" },
      { "website_url": "https://shopify.com" },
      { "website_url": "https://vercel.com" }
    ]
  }' \
  "https://nubela.co/api/v1/monitor/feeds"</div>

The response includes an `rss_url` — this is the URL you subscribe to.

<div class="inline-code">{
  "id": "feed_abc123",
  "rss_url": "https://nubela.co/.../rss.xml?token=sec_live_..."
}</div>

**2. Subscribe to the RSS feed** — copy the `rss_url` and add it to any RSS reader (Feedly, Slack, Zapier, etc.). Blog posts, X posts, and website changes from all targets appear as items in a single feed.

<div class="inline-code">Stripe: Expanding our Payment Network    [blog]
Vercel on X: "Next.js 16 is here"       [x]
Shopify: Pricing Page                    [website update]</div>

Each item includes a category (`blog`, `x`, `website update`, or `website new page`). See [Consume Feed Endpoint](#consume-feed-endpoint) for the full RSS schema.

**3. Add new targets** — a new competitor entered the market? Add them to the feed.

<div class="inline-code">curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "website_url": "https://linear.app" }' \
  "https://nubela.co/api/v1/monitor/feeds/feed_abc123/targets"</div>

**4. Remove targets** — a company is no longer relevant? Remove it from the feed.

<div class="inline-code">curl -X DELETE \
  -H "Authorization: Bearer YOUR_API_KEY" \
  "https://nubela.co/api/v1/monitor/feeds/feed_abc123/targets/target_xyz789"</div>

**5. Change monitoring settings** — by default every target monitors blog posts, X posts, and website changes on a 7-day cadence. Use PATCH to toggle channels or change the frequency.

<div class="inline-code">curl -X PATCH \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "monitor_x": false,
      "frequency_days": 1
    }
  }' \
  "https://nubela.co/api/v1/monitor/feeds/feed_abc123/targets/target_xyz789"</div>

Only the fields you include are changed — omitted fields keep their current values. See [Settings Object](#settings-object) for all available options.

## Pricing

| Action                                                             | Cost                 |
| ------------------------------------------------------------------ | -------------------- |
| Create a feed                                                      | 3 credits (one-time) |
| Blog post pull (per target)                                        | 1 credit/pull        |
| Website monitoring pull (per target)                               | 1 credit/pull        |
| X post updates pull (per target)                                   | 2 credits/pull       |
| YouTube updates pull (per target)                                  | 1 credit/pull        |
| All other endpoints (list, describe, delete feeds; manage targets) | 0 credits            |

Each pull checks one target for one source (blog, X, website, or YouTube). With all four sources enabled, a single target costs **5 credits per pull** (1 blog + 2 X + 1 website + 1 YouTube).

### Example monthly costs

| Scenario                                                            | Targets | Frequency | Credits/month                                      |
| ------------------------------------------------------------------- | ------- | --------- | -------------------------------------------------- |
| VC tracking 20 portfolio companies                                  | 20      | Weekly    | ~**433** credits (3 one-time + 20 × 5 × 4.3 weeks) |
| Startup monitoring 10 competitors                                   | 10      | Daily     | ~**1,503** credits (3 one-time + 10 × 5 × 30 days) |
| Sales team watching 5 prospect accounts (blog + X only, no website) | 5       | Daily     | ~**453** credits (3 one-time + 5 × 3 × 30 days)    |

One-time feed creation cost (3 credits) is included in the first month only.

## List Feeds Endpoint

`GET /api/v1/monitor/feeds`

Cost: `0` credits / request.

Retrieves a list of all feeds owned by the authenticated user.

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  "https://nubela.co/api/v1/monitor/feeds"
```

> Example response:

```json
{
  "feeds": [
    {
      "id": "feed_abc123",
      "name": "SaaS Competitors",
      "is_public": false,
      "rss_url": "https://nubela.co/api/v1/monitor/feeds/feed_abc123/rss.xml?token=sec_live_987654321",
      "created_at": "2026-02-24T00:00:00Z",
      "target_count": 2
    }
  ]
}
```

### Response

| Key     | Description          | Example                         |
| ------- | -------------------- | ------------------------------- |
| `feeds` | List of Feed objects | See [Feed Object](#feed-object) |

### Feed Object

| Key                   | Description                                                            | Example                                                                                 |
| --------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `id`                  | Unique feed identifier                                                 | `"feed_abc123"`                                                                         |
| `name`                | Feed name                                                              | `"SaaS Competitors"`                                                                    |
| `is_public`           | Whether the feed is publicly accessible                                | `false`                                                                                 |
| `is_suspended`        | Whether the feed is currently suspended                                | `false`                                                                                 |
| `suspension_reason`   | Reason for suspension, if suspended                                    | `null` or `"insufficient_credits"`                                                      |
| `rss_url`             | The RSS feed URL. For private feeds, includes a token query parameter. | `"https://nubela.co/api/v1/monitor/feeds/feed_abc123/rss.xml?token=sec_live_987654321"` |
| `email_notifications` | Email notification mode                                                | `"skip"` or `"on_updates"`                                                              |
| `created_at`          | ISO 8601 creation timestamp                                            | `"2026-02-24T00:00:00Z"`                                                                |
| `target_count`        | Number of targets in the feed                                          | `2`                                                                                     |

## New Feed Endpoint

`POST /api/v1/monitor/feeds`

Cost: `3` credits / request (one-time fee).

Creates a new feed and optionally accepts an array of initial targets.

```shell
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SaaS Competitors",
    "is_public": false,
    "targets": [
      {
        "website_url": "https://stripe.com",
        "settings": {
          "monitor_blog": true,
          "monitor_x": true,
          "monitor_website": true,
          "monitor_youtube": true,
          "frequency_days": 7
        }
      },
      {
        "website_url": "https://vercel.com"
      }
    ]
  }' \
  "https://nubela.co/api/v1/monitor/feeds"
```

> Example response `201 Created`:

```json
{
  "id": "feed_abc123",
  "name": "SaaS Competitors",
  "is_public": false,
  "is_suspended": false,
  "suspension_reason": null,
  "rss_url": "https://nubela.co/api/v1/monitor/feeds/feed_abc123/rss.xml?token=sec_live_987654321",
  "created_at": "2026-02-24T09:55:00Z",
  "targets": [
    {
      "id": "target_xyz789",
      "website_url": "https://stripe.com",
      "settings": {
        "monitor_blog": true,
        "monitor_x": true,
        "monitor_website": true,
        "monitor_youtube": true,
        "frequency_days": 7
      },
      "last_polled_at": null,
      "is_baseline_complete": false,
      "created_at": "2026-02-24T09:55:00Z"
    },
    {
      "id": "target_xyz790",
      "website_url": "https://vercel.com",
      "settings": {
        "monitor_blog": true,
        "monitor_x": true,
        "monitor_website": true,
        "monitor_youtube": true,
        "frequency_days": 7
      },
      "last_polled_at": null,
      "is_baseline_complete": false,
      "created_at": "2026-02-24T09:55:00Z"
    }
  ]
}
```

### Request Body

| Parameter             | Required | Description                                                                                                                      | Example                                         |
| --------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `name`                | No       | Name of the feed. If omitted, a name will be auto-generated.                                                                     | `"SaaS Competitors"`                            |
| `is_public`           | No       | Whether the feed is publicly accessible (default: `false`)                                                                       | `false`                                         |
| `email_notifications` | No       | Email notification mode. `"on_updates"` to receive emails when new updates are detected, `"skip"` to disable (default: `"skip"`) | `"on_updates"`                                  |
| `targets`             | Yes      | Array of initial targets to add to the feed (at least 1 required)                                                                | See [Target Input Object](#target-input-object) |

### Target Input Object

| Parameter     | Required | Description                                         | Example                                 |
| ------------- | -------- | --------------------------------------------------- | --------------------------------------- |
| `website_url` | Yes      | The website URL of the company to monitor           | `"https://stripe.com"`                  |
| `settings`    | No       | Monitoring preferences. If omitted, defaults apply. | See [Settings Object](#settings-object) |

### Settings Object

| Parameter         | Required | Description                                                                       | Example |
| ----------------- | -------- | --------------------------------------------------------------------------------- | ------- |
| `monitor_blog`    | No       | Monitor the company's blog for new posts (default: `true`)                        | `true`  |
| `monitor_x`       | No       | Monitor the company's X (Twitter) account (default: `true`)                       | `true`  |
| `monitor_website` | No       | Monitor the company's website for content changes and new pages (default: `true`) | `true`  |
| `monitor_youtube` | No       | Monitor the company's official YouTube channel for new videos (default: `true`)   | `true`  |
| `frequency_days`  | No       | How often to check for updates, in days. Must be between 1 and 30 (default: `7`)  | `7`     |

### Validation Rules

- At least one `targets` entry is required.
- Each target must have a `website_url` that is reachable (HTTP 2xx response). Unreachable URLs return `400`.
- At least one monitor setting (`monitor_blog`, `monitor_x`, `monitor_website`, `monitor_youtube`) must be `true` per target.

### Response

Returns `201 Created`. The response includes the created [Feed Object](#feed-object) with an additional `targets` array containing [Target Object](#target-object) entries.

### Target Object

| Key                    | Description                                                    | Example                                 |
| ---------------------- | -------------------------------------------------------------- | --------------------------------------- |
| `id`                   | Unique target identifier                                       | `"target_xyz789"`                       |
| `website_url`          | The monitored company's website URL                            | `"https://stripe.com"`                  |
| `settings`             | Monitoring preferences object                                  | See [Settings Object](#settings-object) |
| `last_polled_at`       | ISO 8601 timestamp of the last poll, or `null` if never polled | `null`                                  |
| `is_baseline_complete` | Whether the initial baseline snapshot has been captured        | `false`                                 |
| `created_at`           | ISO 8601 creation timestamp                                    | `"2026-02-24T09:55:00Z"`                |

### Response Headers

| Header Key                | Description                             | Example |
| ------------------------- | --------------------------------------- | ------- |
| `X-NinjaPear-Credit-Cost` | Total cost of credits for this API call | `3`     |

### Error Codes

| Status Code | Charged? | Description                                                                   |
| ----------- | -------- | ----------------------------------------------------------------------------- |
| 400         | No       | Validation error (missing targets, unreachable URL, no monitor flags enabled) |

## Describe Feed Endpoint

`GET /api/v1/monitor/feeds/{feed_id}`

Cost: `0` credits / request.

Retrieves full details of a single feed, including all its attached targets.

```shell
curl -G \
  -H "Authorization: Bearer YOUR_API_KEY" \
  "https://nubela.co/api/v1/monitor/feeds/feed_abc123"
```

> Example response:

```json
{
  "id": "feed_abc123",
  "name": "SaaS Competitors",
  "is_public": false,
  "is_suspended": false,
  "suspension_reason": null,
  "rss_url": "https://nubela.co/api/v1/monitor/feeds/feed_abc123/rss.xml?token=sec_live_987654321",
  "created_at": "2026-02-24T09:55:00Z",
  "targets": [
    {
      "id": "target_xyz789",
      "website_url": "https://stripe.com",
      "settings": {
        "monitor_blog": true,
        "monitor_x": true,
        "monitor_website": true,
        "monitor_youtube": true,
        "frequency_days": 7
      },
      "last_polled_at": "2026-02-24T12:00:00Z",
      "is_baseline_complete": true,
      "created_at": "2026-02-24T09:55:00Z"
    },
    {
      "id": "target_xyz790",
      "website_url": "https://vercel.com",
      "settings": {
        "monitor_blog": true,
        "monitor_x": true,
        "monitor_website": true,
        "monitor_youtube": true,
        "frequency_days": 7
      },
      "last_polled_at": null,
      "is_baseline_complete": false,
      "created_at": "2026-02-24T09:55:00Z"
    }
  ]
}
```

### URL Parameters

| Parameter | Required | Description        | Example       |
| --------- | -------- | ------------------ | ------------- |
| `feed_id` | Yes      | The ID of the feed | `feed_abc123` |

### Response

Returns a [Feed Object](#feed-object) with an additional `targets` array containing [Target Object](#target-object) entries.

### Error Codes

| Status Code | Charged? | Description    |
| ----------- | -------- | -------------- |
| 404         | No       | Feed not found |

## Delete Feed Endpoint

`DELETE /api/v1/monitor/feeds/{feed_id}`

Cost: `0` credits / request.

Permanently deletes a feed and all associated targets.

```shell
curl -X DELETE \
  -H "Authorization: Bearer YOUR_API_KEY" \
  "https://nubela.co/api/v1/monitor/feeds/feed_abc123"
```

### URL Parameters

| Parameter | Required | Description                  | Example       |
| --------- | -------- | ---------------------------- | ------------- |
| `feed_id` | Yes      | The ID of the feed to delete | `feed_abc123` |

### Response

Returns `200 OK` with a confirmation message.

```json
{
  "message": "Feed deleted."
}
```

### Error Codes

| Status Code | Charged? | Description    |
| ----------- | -------- | -------------- |
| 404         | No       | Feed not found |

## Add Target Endpoint

`POST /api/v1/monitor/feeds/{feed_id}/targets`

Cost: `0` credits / request.

Adds a new company to an existing feed.

```shell
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "website_url": "https://shopify.com",
    "settings": {
      "monitor_blog": true,
      "monitor_x": true,
      "monitor_website": false,
      "frequency_days": 3
    }
  }' \
  "https://nubela.co/api/v1/monitor/feeds/feed_abc123/targets"
```

> Example response `201 Created`:

```json
{
  "id": "target_xyz791",
  "website_url": "https://shopify.com",
  "settings": {
    "monitor_blog": true,
    "monitor_x": true,
    "monitor_website": false,
    "frequency_days": 3
  },
  "last_polled_at": null,
  "is_baseline_complete": false,
  "created_at": "2026-02-24T10:00:00Z"
}
```

### URL Parameters

| Parameter | Required | Description                             | Example       |
| --------- | -------- | --------------------------------------- | ------------- |
| `feed_id` | Yes      | The ID of the feed to add the target to | `feed_abc123` |

### Request Body

| Parameter     | Required | Description                                         | Example                                 |
| ------------- | -------- | --------------------------------------------------- | --------------------------------------- |
| `website_url` | Yes      | The website URL of the company to monitor           | `"https://shopify.com"`                 |
| `settings`    | No       | Monitoring preferences. If omitted, defaults apply. | See [Settings Object](#settings-object) |

### Response

Returns a [Target Object](#target-object).

### Error Codes

| Status Code | Charged? | Description    |
| ----------- | -------- | -------------- |
| 404         | No       | Feed not found |

## Update Target Endpoint

`PATCH /api/v1/monitor/feeds/{feed_id}/targets/{target_id}`

Cost: `0` credits / request.

Modifies the monitoring preferences for a specific target.

```shell
curl -X PATCH \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "frequency_days": 1,
      "monitor_website": true
    }
  }' \
  "https://nubela.co/api/v1/monitor/feeds/feed_abc123/targets/target_xyz789"
```

### URL Parameters

| Parameter   | Required | Description                    | Example         |
| ----------- | -------- | ------------------------------ | --------------- |
| `feed_id`   | Yes      | The ID of the feed             | `feed_abc123`   |
| `target_id` | Yes      | The ID of the target to update | `target_xyz789` |

### Request Body

| Parameter  | Required | Description                                                | Example                                 |
| ---------- | -------- | ---------------------------------------------------------- | --------------------------------------- |
| `settings` | Yes      | Partial settings update. Only provided fields are changed. | See [Settings Object](#settings-object) |

### Response

Returns the updated [Target Object](#target-object).

> Example response:

```json
{
  "id": "target_xyz789",
  "website_url": "https://stripe.com",
  "settings": {
    "monitor_blog": true,
    "monitor_x": true,
    "monitor_website": true,
    "monitor_youtube": true,
    "frequency_days": 1
  },
  "last_polled_at": "2026-02-24T12:00:00Z",
  "is_baseline_complete": true,
  "created_at": "2026-02-24T09:55:00Z"
}
```

### Error Codes

| Status Code | Charged? | Description                |
| ----------- | -------- | -------------------------- |
| 400         | No       | No valid settings provided |
| 404         | No       | Feed or target not found   |

## Remove Target Endpoint

`DELETE /api/v1/monitor/feeds/{feed_id}/targets/{target_id}`

Cost: `0` credits / request.

Stops monitoring a website and removes it from the feed.

```shell
curl -X DELETE \
  -H "Authorization: Bearer YOUR_API_KEY" \
  "https://nubela.co/api/v1/monitor/feeds/feed_abc123/targets/target_xyz789"
```

### URL Parameters

| Parameter   | Required | Description                    | Example         |
| ----------- | -------- | ------------------------------ | --------------- |
| `feed_id`   | Yes      | The ID of the feed             | `feed_abc123`   |
| `target_id` | Yes      | The ID of the target to remove | `target_xyz789` |

### Response

Returns `200 OK` with a confirmation message.

```json
{
  "message": "Target deleted."
}
```

### Error Codes

| Status Code | Charged? | Description              |
| ----------- | -------- | ------------------------ |
| 404         | No       | Feed or target not found |

## Consume Feed Endpoint

`GET /api/v1/monitor/feeds/{feed_id}/rss.xml`

Cost: `0` credits / request (monitoring costs are incurred per-pull on each target — see [Pricing](#pricing)).

Returns a standard RSS 2.0 XML feed consumed by RSS readers (Feedly, Slack, browser extensions, etc.).

If the feed's `is_public` is `false`, a valid token must be passed as a `token` query parameter.

```shell
curl "https://nubela.co/api/v1/monitor/feeds/feed_abc123/rss.xml?token=YOUR_RSS_TOKEN"
```

> Example response:

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>SaaS Competitors</title>
  <link>https://nubela.co/api/v1/monitor/feeds/feed_abc123/rss.xml</link>
  <description>Automated updates for Stripe, Shopify, and Vercel.</description>
  <lastBuildDate>Tue, 24 Feb 2026 10:00:00 +0800</lastBuildDate>

  <item>
    <title>Stripe: Expanding our Global Payment Network</title>
    <link>https://stripe.com/blog/global-network-2026</link>
    <guid isPermaLink="true">https://stripe.com/blog/global-network-2026</guid>
    <pubDate>Mon, 23 Feb 2026 14:30:00 +0800</pubDate>
    <category>blog</category>
    <dc:creator>Stripe</dc:creator>
    <description>Stripe is expanding its payments infrastructure to 15 new countries, enabling merchants to accept local payment methods seamlessly.</description>
    <enclosure url="https://b.stripecdn.com/blog/og-global-network.jpg" length="150000" type="image/jpeg" />
  </item>

  <item>
    <title>Vercel on X: "Next.js 16 is here..."</title>
    <link>https://x.com/vercel/status/123456789</link>
    <guid isPermaLink="false">x_post_123456789</guid>
    <pubDate>Sun, 22 Feb 2026 10:15:00 +0800</pubDate>
    <category>x</category>
    <dc:creator>Vercel</dc:creator>
    <description>Next.js 16 is here, featuring completely redesigned server components and faster builds. Read the changelog.</description>
    <enclosure url="https://pbs.twimg.com/media/vercel-next16.jpg" length="85000" type="image/jpeg" />
  </item>

  <item>
    <title>Shopify: Pricing Page</title>
    <link>https://shopify.com/pricing</link>
    <guid isPermaLink="false">website_update_shopify_pricing_1708416000</guid>
    <pubDate>Fri, 20 Feb 2026 08:00:00 +0800</pubDate>
    <category>website update</category>
    <dc:creator>Shopify</dc:creator>
    <description>Compare Shopify's pricing plans to find the best fit for your business. Start your free trial today.</description>
    <enclosure url="https://cdn.shopify.com/assets/og-pricing.png" length="210000" type="image/png" />
  </item>

  <item>
    <title>Shopify: Enterprise Plus Solutions</title>
    <link>https://shopify.com/enterprise-plus</link>
    <guid isPermaLink="true">https://shopify.com/enterprise-plus</guid>
    <pubDate>Thu, 19 Feb 2026 11:20:00 +0800</pubDate>
    <category>website new page</category>
    <dc:creator>Shopify</dc:creator>
    <description>Unleash your brand's potential with Shopify Enterprise Plus. High-volume solutions for global commerce.</description>
    <enclosure url="https://cdn.shopify.com/assets/og-enterprise.jpg" length="320000" type="image/jpeg" />
  </item>

</channel>
</rss>
```

### URL Parameters

| Parameter | Required | Description        | Example       |
| --------- | -------- | ------------------ | ------------- |
| `feed_id` | Yes      | The ID of the feed | `feed_abc123` |

### Response Format

The response is a standard RSS 2.0 XML document. The structure is as follows:

### Channel Elements

| Element                 | Description                                   | Example                                                      |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| `&lt;title&gt;`         | The feed name                                 | `SaaS Competitors`                                           |
| `&lt;link&gt;`          | URL of the RSS feed                           | `https://nubela.co/api/v1/monitor/feeds/feed_abc123/rss.xml` |
| `&lt;description&gt;`   | Auto-generated summary of monitored companies | `Automated updates for Stripe, Shopify, and Vercel.`         |
| `&lt;lastBuildDate&gt;` | RFC 2822 timestamp of the last feed build     | `Tue, 24 Feb 2026 10:00:00 +0800`                            |

### Item Elements

Each `&lt;item&gt;` represents a single update from a monitored company.

| Element               | Description                                                                               | Example                                                           |
| --------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `&lt;title&gt;`       | Update title, prefixed with the company name                                              | `Stripe: Expanding our Global Payment Network`                    |
| `&lt;link&gt;`        | URL of the original content                                                               | `https://stripe.com/blog/global-network-2026`                     |
| `&lt;guid&gt;`        | Unique identifier for the item. `isPermaLink` is `true` when the GUID is a URL.           | `https://stripe.com/blog/global-network-2026`                     |
| `&lt;pubDate&gt;`     | RFC 2822 publication timestamp                                                            | `Mon, 23 Feb 2026 14:30:00 +0800`                                 |
| `&lt;category&gt;`    | Update type (see categories below)                                                        | `blog`                                                            |
| `&lt;dc:creator&gt;`  | Company name (uses Dublin Core namespace)                                                 | `Stripe`                                                          |
| `&lt;description&gt;` | Summary or excerpt of the update                                                          | Text content                                                      |
| `&lt;enclosure&gt;`   | Optional image attachment with `url`, `length` (bytes), and `type` (MIME type) attributes | `&lt;enclosure url="..." length="150000" type="image/jpeg" /&gt;` |

### RSS Item Categories

Each `&lt;item&gt;` includes a `&lt;category&gt;` element indicating the update type:

| Category              | Description                                               |
| --------------------- | --------------------------------------------------------- |
| `blog`                | A new blog post from the company                          |
| `x`                   | A post from the company's X (Twitter) account             |
| `website update`      | A change detected on an existing page                     |
| `website new page`    | A new page detected on the company's website              |
| `website unreachable` | The company's website has become unreachable (fired once) |

### Error Codes

| Status Code | Charged? | Description                                 |
| ----------- | -------- | ------------------------------------------- |
| 403         | No       | Missing or invalid token for a private feed |
| 404         | No       | Feed not found                              |

## Update Feed Endpoint

`PATCH /api/v1/monitor/feeds/{feed_id}`

Cost: `0` credits / request.

Update feed settings such as name, visibility, or suspension status. Feeds suspended for `insufficient_credits` are automatically resumed when credits are added.

```shell
# Suspend a feed
curl -X PATCH \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "is_suspended": true, "suspension_reason": "manual" }' \
  "https://nubela.co/api/v1/monitor/feeds/feed_abc123"
```

```python
import requests

response = requests.patch(
    "https://nubela.co/api/v1/monitor/feeds/feed_abc123",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={"is_suspended": True, "suspension_reason": "manual"},
)
```

```javascript
const response = await fetch(
  "https://nubela.co/api/v1/monitor/feeds/feed_abc123",
  {
    method: "PATCH",
    headers: {
      Authorization: "Bearer YOUR_API_KEY",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ is_suspended: true, suspension_reason: "manual" }),
  },
);
```

> Example response (same as Describe Feed):

```json
{
  "id": "feed_abc123",
  "name": "My Feed",
  "is_public": false,
  "is_suspended": true,
  "suspension_reason": "manual",
  "rss_url": "https://nubela.co/api/v1/monitor/feeds/feed_abc123/rss.xml?token=...",
  "created_at": "2025-01-15T10:30:00Z",
  "targets": [...]
}
```

### URL Parameters

| Parameter | Required | Description        | Example       |
| --------- | -------- | ------------------ | ------------- |
| `feed_id` | Yes      | The ID of the feed | `feed_abc123` |

### Request Body

| Parameter             | Required | Description                                                                                                  | Example        |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------------ | -------------- |
| `name`                | No       | New feed name                                                                                                | `"My Feed"`    |
| `is_public`           | No       | Whether the RSS feed is publicly accessible                                                                  | `true`         |
| `is_suspended`        | No       | Set `true` to suspend, `false` to resume                                                                     | `true`         |
| `suspension_reason`   | No       | Reason for suspension (only when `is_suspended` is `true`, default `"manual"`)                               | `"manual"`     |
| `email_notifications` | No       | Email notification mode. `"on_updates"` to receive emails when new updates are detected, `"skip"` to disable | `"on_updates"` |

At least one field must be provided.

### Response

Returns the updated [Feed Object](#feed-object) with an additional `targets` array containing [Target Object](#target-object) entries.

### Error Codes

| Status Code | Charged? | Description              |
| ----------- | -------- | ------------------------ |
| 400         | No       | No valid fields provided |
| 404         | No       | Feed not found           |

# Claude AI

NinjaPear provides an MCP (Model Context Protocol) server for direct integration with Claude. This allows you to query B2B company data conversationally — ask Claude about any company's customers, investors, employee count, and more.

## Quick Start

1. Get your connector string from the [Dashboard](/dashboard/ai-integrations/claude)
2. Add NinjaPear as a connector in Claude (see setup instructions below)
3. Start a new conversation and query B2B company data conversationally

## Setup

Your connector string is available on the [Dashboard](/dashboard/ai-integrations/claude). It looks like: `https://nubela.co/mcp/sse?api_key=YOUR_API_KEY`

### Claude Platform (Recommended)

1. Get your connector string from the [Dashboard](/dashboard/ai-integrations/claude)
2. Make sure you're logged into Claude, then visit: [Add Custom Connector](https://claude.ai/settings/connectors?modal=add-custom-connector)
3. Enter the following:
   - **Name**: `NinjaPear`
   - **Remote MCP server URL**: Paste your connector string from step 1
4. Click **Add connector**
5. Start a new conversation and ask Claude to use NinjaPear

### Claude Code CLI

Get your connector string from the [Dashboard](/dashboard/ai-integrations/claude), then run:

`claude mcp add ninjapear --transport sse "YOUR_CONNECTOR_STRING"`

<aside class="warning">When using Claude Code CLI, NinjaPear capabilities will only be available in your local CLI environment. They will <strong>not</strong> be available in claude.ai or Claude Cowork. For NinjaPear access across all Claude interfaces (web, desktop, and Cowork), use the Claude.ai / Claude Desktop setup above instead.</aside>

## Available Tools

| Tool                     | Description                                         | Cost          |
| ------------------------ | --------------------------------------------------- | ------------- |
| `get_customer_listing`   | Get customers, investors, and partners of a company | 1 + 2/company |
| `get_company_details`    | Get company info, executives, financials            | 2-4 credits   |
| `get_employee_count`     | Get employee count for a company                    | 2 credits     |
| `check_disposable_email` | Check if email is disposable/free                   | FREE          |
| `get_credit_balance`     | Check your credit balance                           | FREE          |
| `get_company_logo_url`   | Get company logo URL                                | FREE          |
| `list_feeds`             | List all your monitoring feeds                      | 0 credits     |
| `create_feed`            | Create a new monitoring feed with targets           | 3 credits     |
| `describe_feed`          | Get feed details with all targets                   | 0 credits     |
| `update_feed`            | Update feed name, visibility, or suspension         | 0 credits     |
| `delete_feed`            | Delete a feed and all its targets                   | 0 credits     |
| `add_target`             | Add a company to monitor in a feed                  | 0 credits     |
| `update_target`          | Update monitoring settings for a target             | 0 credits     |
| `remove_target`          | Remove a company from a feed                        | 0 credits     |
| `consume_feed`           | Read the latest updates from a feed                 | FREE          |

<aside class="notice">Feed creation costs 3 credits. Monitoring pulls are charged per target on schedule — blog: 1 credit, website: 1 credit, X: 2 credits.</aside>

## Example Prompts

Once connected, you can ask Claude questions like:

**Competitive Intelligence**

You're a product manager tracking what your competitors are up to.

- "Monitor stripe.com, brex.com, and ramp.com for blog posts and website changes. Check daily."
- "What are the latest updates from my competitor feed?"
- "Get company details for each of my competitors — I want to know their employee counts and executives"
- "Who are Stripe's customers? Cross-reference them with Brex's customers to find overlap"

**VC Portfolio Monitoring**

You're a VC who wants to stay on top of portfolio company activity. Upload a CSV or screenshot of your portfolio companies to Claude, then ask:

- "Create a monitoring feed for all these companies — track their blogs and website changes weekly"
- "Show me the latest updates across my portfolio feed"
- "Get employee counts for each of my portfolio companies — I want to see who's growing fastest"
- "Which of my portfolio companies have the most customers?"

**Sales Prospecting**

You're in sales and want to research accounts before outreach.

- "Get company details for acme.com — who are their executives, and what industry are they in?"
- "How many employees does acme.com have?"
- "Who are Salesforce's customers? Get company details for the top 5 by employee count"
- "Is john@acme.com a real business email or a disposable address?"
- "Check if these emails are disposable: test@mailinator.com, jane@company.io"

**Market Research**

You're an analyst mapping out an industry landscape.

- "Find the investors behind Figma, Canva, and Miro. Who are the common VCs?"
- "Get company details for anthropic.com, openai.com, and cohere.com — compare their founding year, employee count, and specialties"
- "Who are the partners of Shopify? Get employee counts for each partner"
- "Get logos for stripe.com, square.com, and adyen.com — I'm building a market map"

**Monitoring and Alerts**

You want to set up ongoing monitoring and come back to check updates.

- "Create a feed called 'AI Companies' to track openai.com, anthropic.com, and deepmind.google — monitor blogs and X posts"
- "Add mistral.ai to my AI Companies feed"
- "Change the monitoring frequency for Anthropic to daily — they ship fast"
- "Pause my AI Companies feed for now, I'll resume it next quarter"
- "What's my current credit balance? How long will my monitoring last at this rate?"

**Account Management**

Quick checks on your NinjaPear usage.

- "What's my credit balance?"
- "How many credits do I have left?"

## Error Handling

Errors are returned as descriptive messages that Claude will explain to you:

| Error                | Message                            |
| -------------------- | ---------------------------------- |
| Invalid API key      | "Error: 401 Unauthorized"          |
| Insufficient credits | "Error: 402 Payment Required"      |
| Rate limited         | "Error: 429 Too Many Requests"     |
| Server error         | "Error: 500 Internal Server Error" |

## Technical Details

### MCP Protocol

The NinjaPear MCP server implements the [Model Context Protocol](https://modelcontextprotocol.io/) specification, which is Anthropic's open standard for connecting AI assistants to external data sources and tools.

### Transport

We use Server-Sent Events (SSE) transport for real-time communication:

- **SSE Endpoint**: `GET /mcp/sse?api_key=YOUR_API_KEY`
- **Messages Endpoint**: `POST /mcp/messages/`
- **Health Check**: `GET /mcp/health`

### Authentication

Pass your API key via the `api_key` query parameter or the `X-API-Key` header