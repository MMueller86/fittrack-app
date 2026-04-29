# GitHub Copilot Planner – Master Prompt

Plan a production-ready cross-platform mobile application for nutrition and training tracking.

Use the supporting specification files in this workspace as the primary source of truth.

## Use Supporting Files (Authoritative Input)
- product_requirements.md
- epics_and_stories.md
- calculation_logic.md
- architecture.md
- data_model.md
- api_design.md
- screen_flows.md
- non_functional_requirements.md
- azure_environment.md
- design_assets_notes.md

## Design Assets
- app_logo.png → official product logo. Use this as visual identity reference for UI/branding decisions.
- story_map_fancy.png → visual story map for product understanding.
- mvp_screen_examples.png → visual MVP UI inspiration; use as soft guidance only, not as a source of new scope.

Do not contradict these files. Ask clarifying questions if needed.

## Product Goal
Android-first cross-platform app for:
- nutrition targets
- weight tracking
- nutrition diary (meal → items)
- recipes
- guided AI workflows

## Core Rules
- Cloud data = source of truth
- AI assistive only
- User confirms before save
- Reuse reduces AI cost
- No generic AI chat in MVP
- Backend owns all AI interactions and secrets

## Tasks
1. High-level architecture
2. Mobile app modules
3. Backend modules
4. Cosmos DB design
5. API surface
6. Infrastructure-as-Code plan
7. MVP roadmap
8. Risks and open questions
