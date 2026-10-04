# CLEAR

Product status and the full specification are in `PRODUCT_SPEC.md`. Commit to `main` directly.

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

## Voice

Choose **Use your voice**, then **Speak a question** to dictate into the ask box. In a lesson, open **Voice Tutor** to listen to the lesson or speak a follow-up. **Teach it back** also accepts dictated text and can read the feedback aloud. Review the words before submitting them.

Speech input needs HTTPS or localhost and a browser with [speech recognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition). Some browsers use a remote recognition service. Narration uses the browser's speech service. CLEAR stores submitted text, not raw audio. Unsupported browsers retain typed input and readable transcripts. Provider-native realtime audio is not connected yet; lesson turns continue through the selected explanation provider.

For a local voice check, open the sample lesson, listen and pause/resume/stop, switch narration sections, dictate a follow-up, review/edit it, and send. Check denied microphone permission and text fallback too. With the mock provider, the reply is a development fixture rather than model tutoring.

## Portable skill

Open **Skill** to choose learner level, depth, analogies, visuals, interview practice, recall checks, and writing style. The live preview shows all seven files. **Download CLEAR skill** creates a ZIP with your preferences; **Copy SKILL.md** copies the main instructions.

Unzip it and keep the `clear-explainer` folder together, then add it to the skill location supported by your agent. The package contains public teaching instructions and examples. It excludes conversations, uploads, learning memory, and provider keys. Exporting needs no account or API key; the host agent supplies its own model and tools.

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
