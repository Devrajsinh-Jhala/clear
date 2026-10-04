import { PageShell } from "@/components/page-shell";
import { ProgressBoard } from "@/components/progress/ProgressBoard";
import { currentLearningProfile } from "@/src/lib/learning/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const profile = await currentLearningProfile();
  return (
    <PageShell title="Your learning" lede="Learning memory is off until you choose to keep it.">
      <ProgressBoard enabled={profile.enabled} concepts={profile.concepts} misconceptions={profile.misconceptions} />
    </PageShell>
  );
}
