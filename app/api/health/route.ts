import { withApiGuard } from "@/src/lib/api/guard";
import { deploymentChecks } from "@/src/lib/deployment/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApiGuard(request, "mutation", async () => {
    const ready = deploymentChecks().every((check) => check.ready);
    return Response.json({ ready }, { status: ready ? 200 : 503 });
  });
}
