# @sci-healthcare/client

Typed TypeScript client for the SCI Healthcare indexer and API on Stellar.

## Overview

This package provides a type-safe API client and TypeScript models generated from the backend OpenAPI specification (`/openapi.json`). It guarantees that frontend consumers, test suites, and external integrations stay in sync with the backend read models and routes.

## Installation

```bash
npm install @sci-healthcare/client
```

Or within the workspace:

```json
{
  "dependencies": {
    "@sci-healthcare/client": "*"
  }
}
```

## Quick Start

```typescript
import { createClient } from '@sci-healthcare/client';

const client = createClient({
  baseUrl: process.env.API_URL || 'https://api.example.com',
});

// Fetch system health & stats
const health = await client.health();
const stats = await client.stats();

// Query clinics with type-safe filters
const { providers } = await client.providers({
  status: 'Active',
  country: 'KE',
  limit: 20,
});

// Retrieve voucher details
const voucher = await client.voucher('0001');

// Query care receipts by beneficiary HMAC reference
const receipts = await client.receipts({
  beneficiaryRef: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
});
```

## Error Handling

All HTTP and API validation errors are mapped to `ApiError`:

```typescript
import { ApiError } from '@sci-healthcare/client';

try {
  await client.vouchers({ minAmount: '100', maxAmount: '50' });
} catch (err) {
  if (err instanceof ApiError) {
    console.error(`API Error ${err.status} [${err.error}]: ${err.message}`);
    console.error('Validation issues:', err.issues);
  }
}
```
