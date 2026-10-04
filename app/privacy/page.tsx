import { PageShell } from "@/components/page-shell";

export default function PrivacyPage() {
  return (
    <PageShell title="Privacy" lede="CLEAR storage and the AI provider are different places.">
      <p>A question you submit to CLEAR Free is sent to Google Gemini from the CLEAR server. With your own key, the question goes to your selected provider. The sample lesson is not sent.</p>
      <p>Guest lessons and submitted conversation text are stored so the lesson address can reload. Anyone with that address can open the lesson. Accounts and a saved library are not available yet.</p>
      <p>Connected API keys are encrypted at rest and associated with this browser. Stored keys are not returned to the browser.</p>
      <p>Learning memory is off until you turn it on in Settings. You can delete one concept or every learning record.</p>
      <p>Voice input starts only when you choose a microphone control. Your browser or operating system may send audio to its speech recognition service. CLEAR does not receive or store that audio. Recognized words remain editable and go to CLEAR and the selected model only when you submit them.</p>
      <p>Lesson narration uses your browser or operating system’s speech service, which may process text remotely. A readable transcript is available. You can stop listening at any time.</p>
    </PageShell>
  );
}
