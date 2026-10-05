import { z } from "zod";

import { withApiGuard } from "@/src/lib/api/guard";
import { signInWithPassword } from "@/src/lib/auth/service";
import { readBoundedJson } from "@/src/lib/security/limits/body";

export const runtime = "nodejs";
const input = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) }).strict();

export async function POST(request: Request) {
  return withApiGuard(request, "auth", async () => {
    const { email, password } = input.parse(await readBoundedJson(request, 2048));
    await signInWithPassword(email, password);
    return Response.json({ signedIn: true });
  });
}
