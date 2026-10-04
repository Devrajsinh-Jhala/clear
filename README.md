# CLEAR

AI knows the answer. CLEAR helps you understand it.

CLEAR turns a question into one explanation document, then renders that document as an understandable lesson: a short account, a mental model, examples, and a follow-up that updates the same lesson.

## Run locally

```bash
npm install
copy .env.example .env.local
```

Add `GEMINI_API_KEY` to `.env.local`, then:

```bash
npm run dev
```

Open http://localhost:3000. Ask a question, or choose **See an example** to open the mutex lesson without calling a model.

Set `CLEAR_PROVIDER=mock` if you want generated lessons without Gemini. The lesson is labeled as a local mock.

## Checks

```bash
npm test
npm run lint
```

## Where things live

- `src/lib/explanation/schema.ts` — the canonical explanation document
- `src/lib/ai` — provider contract, Gemini adapter, local mock
- `src/lib/explanation` — validation, repair, generation, follow-up
- `supabase/migrations` — Postgres schema and row-level security
- Lessons are stored in `.data/` until Supabase credentials are set

Provider requests run on the server. Do not put API keys in `NEXT_PUBLIC_` variables.
