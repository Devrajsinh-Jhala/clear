import { withApiGuard } from "@/src/lib/api/guard";
import { signOutAccount } from "@/src/lib/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withApiGuard(request, "mutation", async () => {
    await signOutAccount();
    return Response.json({ signedOut: true });
  });
}
