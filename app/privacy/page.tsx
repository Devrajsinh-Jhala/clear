import { PageShell } from "@/components/page-shell";

export default function PrivacyPage() {
  return (
    <PageShell title="Privacy" lede="CLEAR storage and the AI provider are different places.">
      <p>A question you submit to CLEAR Free is sent to Google Gemini from the CLEAR server. With your own key, the question goes to your selected provider. The sample lesson is not sent.</p>
      <p>Each provider handles what it receives under its own terms. Depending on the Gemini plan behind CLEAR Free, Google may keep submitted content and use it to improve its products. Do not send anything confidential to CLEAR Free.</p>
      <p>Accounts use an email address and a password. CLEAR does not currently confirm that you own the address, and it cannot reset a forgotten password yet.</p>
      <p>New guest lessons and submitted conversation text belong to the browser that created them. Their addresses reload only in that browser. Clearing its site data removes access. When sign-in is configured, new lessons created while signed in belong to your account and appear in your library. Signing in does not import earlier guest lessons or keys.</p>
      <p>Earlier lessons created before browser ownership was added remain readable by anyone with their address. They are read-only; making a private copy keeps only the explanation and lets you continue in this browser.</p>
      <p>A share link publishes a frozen explanation that anyone with the link can read and download. Original uploads, follow-up messages, teach-back feedback, learning records, and provider keys stay private. The explanation itself may include material from your question or files, so review its preview before sharing. Replacing or revoking a link stops access through that link; it cannot remove copies already downloaded.</p>
      <p>Markdown, JSON, and PDF downloads contain the explanation and quiz answers. Provider and model names are hidden unless you choose to include them.</p>
      <p>Connected API keys are encrypted at rest and associated with your signed-in account or, for guests, this browser. Stored keys are not returned to the browser. Hosted deployments keep private records and original uploads in Supabase; original uploads never have a public download URL.</p>
      <p>Learning memory is off until you turn it on in Settings. You can delete one concept or every learning record.</p>
      <p>Voice input starts only when you choose a microphone control. Your browser or operating system may send audio to its speech recognition service. CLEAR does not receive or store that audio. Recognized words remain editable and go to CLEAR and the selected model only when you submit them.</p>
      <p>Lesson narration uses your browser or operating system’s speech service, which may process text remotely. A readable transcript is available. You can stop listening at any time.</p>
      <p>Usage limits keep a keyed hash of the browser or account identity and the trusted network address. Operational error monitoring, when configured, receives generic error categories and code locations. CLEAR excludes questions, lesson text, uploads, keys, email addresses, network addresses, cookies and conversation identifiers from those reports.</p>
    </PageShell>
  );
}
