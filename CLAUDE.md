# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run on device/simulator
npx expo start          # start dev server (scan QR with Expo Go)
npx expo start --ios    # open iOS simulator
npx expo start --android

# EAS builds (App Store / Play Store)
eas build --platform ios
eas build --platform all

# Deploy Supabase Edge Function
supabase functions deploy cellie
supabase functions deploy delete-user

# Eval suite (from repo root)
./run_evals.sh                            # run 25 seed test cases
python3 judge.py results/run_LATEST.jsonl # LLM-as-judge scoring
python3 dashboard.py --compare            # regression comparison
python3 generate_tests.py --count 200 --output generated_tests.csv
```

## Architecture

The entire React Native app lives in a single file: **[App.js](App.js)** (~6,500 lines). There is no navigation library — screen transitions are managed by conditional rendering based on context state.

### State management

Two React contexts, each backed by `useReducer`:

- **`AppCtx` / `appReducer`** (line ~604) — parent account, logged-in status, kids list, active kid, session timing. Persisted to `AsyncStorage` under `@money_cells_app_state`.
- **`GameCtx` / `gameReducer`** (line ~967) — the active cell-colony game state for the current kid. Persisted per-kid under `@money_cells_game_state_<kidId>`.

Auth tokens are stored in `expo-secure-store` via a custom adapter passed to the Supabase client.

### Game engine

The core loop lives in `resolveRound()` (line ~489) and `createGame()` (line ~457). Key concepts:

- **Cells** grow each round at a `rate` (slow/medium/fast = 2%/5%/10%). Each cell has a monetary value derived from `cellsToCents(cells, rate)`.
- **Colony cap** is 50 cells. At 40 cells the amber warning fires (`COLONY_WARN`). At 50, `retireColony()` archives the generation and `startNextColony()` carries 3 bonus starter cells (`BONUS_CARRY`).
- **Performance tiers** control animation fidelity: Tier 1 (≤20 cells) = full animations, Tier 2 (21–35) = breathe only, Tier 3 (36–50) = static dots. This is enforced in `Cell` (line ~1647) and `PetriDish` (line ~1935).
- **Resistance meter** tracks impulse-buy resistance (0–100). Resisting a flash deal adds `RESIST_GAIN` (22); buying loses `RESIST_LOSS` (30). Filling it awards `RESIST_BONUS_CELLS` (3).

### AI — Cellie Edge Function

`supabase/functions/cellie/index.ts` is a single Deno function handling four modes via the `mode` field in the request body:

| Mode | Model | Purpose |
|---|---|---|
| `chat` | Claude Haiku 4.5 | Kid Q&A during gameplay |
| `vision` | Claude Sonnet 4.6 | Photo "worth it?" purchase analysis |
| `parent` | Claude Opus 4.6 | Parent coaching card |
| `image` | DALL-E 3 (OpenAI) | Goal image generation |

RAG uses OpenAI `text-embedding-3-small` with a 5-second timeout; failures fall back to general knowledge.

To enable AI features, uncomment the URL constants near the top of App.js:
```js
const CELLIE_URL        = 'https://YOUR.supabase.co/functions/v1/cellie';
const CELLIE_VISION_URL = 'https://YOUR.supabase.co/functions/v1/cellie';
const CELLIE_IMAGE_URL  = 'https://YOUR.supabase.co/functions/v1/cellie';
```

Required Supabase secrets: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Supabase schema (tables written to)

`sessions`, `events`, `goals`, `feedback` — all have a `user_id` foreign key. Account deletion hits all four tables then calls the `delete-user` Edge Function to remove the `auth.users` record (must happen before `signOut`).

### Theme

All colors are on the `C` object (line ~48). The app uses a dark green palette (`#0a0f0a` background). `userInterfaceStyle` is locked to `"dark"` in app.json.

### Eval suite

The eval tooling in the repo root (`run_evals.sh`, `judge.py`, `dashboard.py`, `generate_tests.py`) tests Cellie response quality against `test_cases.csv`. Results land in `results/`. These call the live Cellie API — they are not unit tests and require a deployed Edge Function.
