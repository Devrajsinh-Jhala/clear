import { PageShell } from "@/components/page-shell";

export default function PrivacyPage() {
  return (
    <PageShell title="Privacy" lede="CLEAR storage and the AI provider are different places.">
      <p>A question you submit to CLEAR Free is sent to Google Gemini from the CLEAR server. With your own key, the question goes to your selected provider. The sample lesson is not sent.</p>
      <p>New guest lessons and submitted conversation text are stored for the browser that created them. Their addresses reload only in that browser. Clearing its site data removes access. Accounts and a saved library are not available yet.</p>
      <p>Earlier lessons created before browser ownership was added remain readable by anyone with their address. They are read-only; making a private copy keeps only the explanation and lets you continue in this browser.</p>
      <p>A share link publishes a frozen explanation that anyone with the link can read and download. Original uploads, follow-up messages, teach-back feedback, learning records, and provider keys stay private. The explanation itself may include material from your question or files, so review its preview before sharing. Replacing or revoking a link stops access through that link; it cannot remove copies already downloaded.</p>
      <p>Markdown, JSON, and PDF downloads contain the explanation and quiz answers. Provider and model names are hidden unless you choose to include them.</p>
      <p>Connected API keys are encrypted at rest and associated with this browser. Stored keys are not returned to the browser.</p>
      <p>Learning memory is off until you turn it on in Settings. You can delete one concept or every learning record.</p>
      <p>Voice input starts only when you choose a microphone control. Your browser or operating system may send audio to its speech recognition service. CLEAR does not receive or store that audio. Recognized words remain editable and go to CLEAR and the selected model only when you submit them.</p>
      <p>Lesson narration uses your browser or operating system’s speech service, which may process text remotely. A readable transcript is available. You can stop listening at any time.</p>
    </PageShell>
  );
}
