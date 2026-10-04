import { PageShell } from "@/components/page-shell";

export default function PrivacyPage() {
  return (
    <PageShell title="Privacy" lede="CLEAR storage and the AI provider are different places.">
      <p>A question you submit to CLEAR Free is sent to Google Gemini from the CLEAR server. The sample lesson is not sent.</p>
      <p>Guest lessons are stored so the lesson address can reload. They are not a library, and they are not used to build a learning profile.</p>
      <p>API keys you connect later will be encrypted at rest. CLEAR does not put them in the browser, logs, or analytics.</p>
      <p>Learning memory will be off until you turn it on, and you will be able to delete it.</p>
    </PageShell>
  );
}
