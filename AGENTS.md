# AGENTS.md

## Objective
This project is a React Native app built with Expo.

## How to work in this repository
- Before implementing, look for a similar existing pattern in the codebase and follow it.
- Make minimal, safe changes.
- Do not introduce new dependencies unless clearly justified.
- Do not change existing endpoint names, routes, or contracts.
- Keep the current code style and architecture.
- Avoid unrelated refactors or broad cleanups unless explicitly requested.

## Conventions
- Use strict TypeScript.
- Prefer small, pure functions.
- Always use English names in code.
- Do not rename existing public interfaces, endpoints, or route params without explicit confirmation.

## When in doubt
If there is relevant ambiguity about architecture, code location, naming, or structure:
- Do not assume the solution automatically.
- First check for existing patterns in the codebase.
- If ambiguity remains, ask the user before proceeding.

The question should:
- briefly explain the ambiguity
- present 2 or 3 possible options
- indicate which option seems most consistent with the existing patterns

Avoid asking about trivial details already defined by the project conventions.

## Before finishing
Run:
- `npm run lint`
- `npx tsc --noEmit`

Then summarize:
- what was changed
- risks
- points that still need validation