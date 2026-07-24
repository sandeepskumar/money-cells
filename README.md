# Money Cells

A financial literacy app for kids aged 6–12. Kids grow a petri dish colony where each cell = $1 — saving lets cells split and multiply, spending makes them disappear forever. Built with React Native / Expo.

## What it teaches

- **Compound growth** — cells split each round; saving longer = faster growth
- **Opportunity cost** — spent cells can't grow back
- **Impulse control** — Flash Deals trigger urgency; resisting fills the Resistance Meter and earns bonus cells
- **Goal-setting** — kids save toward real items (shop catalog or Amazon wishlist)

## Key features

- 🧬 **Cellie AI** — in-game tutor (Haiku 4.5), vision-based purchase analysis (Sonnet 4.6), and parent coaching (Opus 4.6)
- 📷 **Cellie Vision** — take a photo of any item to get a "worth it?" verdict and auto-create a savings goal
- 🎯 **Goal tracking** — shop catalog + Amazon wishlist integration with cell cost estimation
- 💪 **Resistance Meter** — 5-star meter rewards consecutive rounds without spending
- 🏛️ **Colony Museum** — history of all past colonies with stats
- 👪 **Parent dashboard** — PIN-gated; per-kid stats, AI coaching, goal management
- 🎓 **Quiz** — 45 questions across cell biology, compound growth, and money science (3 difficulty tiers)

## Tech stack

| Layer | Technology |
|---|---|
| App | React Native + Expo SDK 54 (single `App.js`) |
| Build / Submit | EAS Build + EAS Submit |
| Backend | Supabase (auth, database, edge functions) |
| AI — chat | Claude Haiku 4.5 |
| AI — vision | Claude Sonnet 4.6 |
| AI — parent | Claude Opus 4.6 |
| AI — goal image | DALL-E 3 (OpenAI) |

## Development

```bash
npm install
npx expo start          # Expo Go (limited — no camera/biometrics)
eas build --platform ios --profile preview   # TestFlight build
eas submit --platform ios                    # App Store submission
```

Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key.

## Edge function

The `cellie` Supabase edge function handles all AI calls.

```bash
supabase functions deploy cellie
```

Requires secrets: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.

## App structure

Everything lives in `App.js` — reducer, game logic, all screens. Key sections:

- **Constants** (`C`, `COLONY_HUES`, `GEM_COLORS`, `QUIZ_QUESTIONS`) — top of file
- **`createGame` / `resolveRound`** — core game logic
- **`KidGameFlow` / `KidGameScreen`** — main game UI
- **`ParentHomeScreen`** — dashboard, kid management, PIN/password reset
- **`AddGoalScreen`** — Cellie Vision + shop/Amazon catalog
- **`CellieModal`** — in-game AI chat + photo analysis
- **`SetNewPasswordScreen`** — password + PIN reset flow
