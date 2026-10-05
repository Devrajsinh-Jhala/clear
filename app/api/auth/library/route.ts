import { withApiGuard } from "@/src/lib/api/guard";
import { listAccountLessons } from "@/src/lib/auth/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApiGuard(request, "mutation", async () => Response.json({ lessons: await listAccountLessons() }));
}
