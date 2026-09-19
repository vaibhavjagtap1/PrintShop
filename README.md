# PrintShop

Minimal production foundation for a mobile-first print ordering flow with server-verified UPI-only payment and print queue gating.

## Workspace layout

- `apps/web` – reserved for Next.js app-router UI
- `apps/api` – API/business logic for order, payment verification, print enqueue
- `apps/agent` – reserved for local print-agent implementation
- `packages/shared` – shared page-limit and pricing engine logic

## Implemented constraints in this iteration

- UPI-only payment method in server payment creation
- Merchant-configurable page cap with default 100
- Hard block logic and exact cap message
- Payment webhook signature verification (HMAC-SHA256)
- Idempotent webhook handling (dedupe on event id)
- Print enqueue only after verified captured payment + available printer
- Foundational Docker services for Postgres, Redis, MinIO, and Gotenberg

## Install

```bash
npm install
npm test
```

## Notes

- This repository now includes core domain primitives and tests for page caps, pricing recomputation, and payment→print idempotency.
- Full UI stepper, auth, file pipeline workers, and live printer agent transport are scaffolded as next implementation steps.
