# Product Philosophy

## Mission

FitTrack is a mobile nutrition and training companion for people who want clear insight into what they eat and how it relates to their goals. The app prioritizes informed decisions over automation.

## MVP Scope

Confirmed MVP features:
- Google SSO / Entra CIAM authentication
- Guided onboarding (profile + goals)
- Nutrition target calculation (Mifflin-St Jeor)
- Daily nutrition diary with meals and macro tracking
- Weight tracking with trend visualization
- Reusable food library (personal catalog)
- Recipe management
- AI-assisted food entry (parse, estimate, scan, image)
- Daily AI personal insight (progress briefing)
- Open Food Facts catalog integration

Explicitly out of MVP scope:
- Health/heart rate/steps dashboard widgets
- Offline mode
- Generic AI chat
- Admin UI

## Core Principles

### 1. Guided Workflows over Raw Features

The app does not expose raw AI capabilities. Every AI feature is wrapped in a task-specific guided workflow with a clear start, review step, and confirmation. The user always knows what they are confirming.

### 2. AI-Assisted but Human-Confirmed

[Rule] AI estimates are previews, not results. The user must explicitly confirm before any AI output is saved to their data. This protects data quality and user trust.

### 3. Backend Owns Intelligence

No direct AI calls from the mobile app. The mobile app calls FitTrack backend APIs. The backend orchestrates AI. This keeps API keys secure and allows the backend to validate, enrich, and quota-manage AI responses.

### 4. Reuse-First Nutrition Logging

Users build a personal food library over time. The food search prioritizes the user's own library before the general catalog. Frequently used foods become favorites for one-tap access.

### 5. Cost-Aware Design

- Azure gpt-4o-mini (cost-efficient model for MVP)
- Monthly quotas per feature per user
- Serverless infrastructure (pay per use)
- On-the-fly day summary calculation (no redundant storage)

### 6. Cloud-Only, Internet Required

No offline mode. Persisted cloud data is the source of truth. The app fails gracefully when offline (friendly error messages, no data corruption).

### 7. Consistency Beats Perfection

The hint engine and daily insight system are designed to reward consistent logging, not perfect tracking. Motivational copy reflects this philosophy.

## MVP Milestones (Internal Reference)

- **M1** — Core infrastructure, profile, diary, weight tracking (complete)
- **M2** — Auth + onboarding (auth endpoints are stubs — CIAM handles tokens directly)
- **M3** — Dashboard today endpoint (stub: returns 501)

## Technology Philosophy

- TypeScript everywhere — type safety across the full stack
- Shared types as the contract between backend and mobile
- Zod for runtime validation at API boundaries
- Pure functions for all business logic (testable, deterministic)
- Repository pattern for data access (swappable implementations)
