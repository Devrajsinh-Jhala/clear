import { z } from "zod";

import { withApiGuard } from "@/src/lib/api/guard";
import { verifyEmailCode } from "@/src/lib/auth/service";
import { readBoundedJson } from "@/src/lib/security/limits/body";

export const runtime = "nodejs";
const input = z.object({ email: z.string().trim().email().max(254), token: z.string().trim().regex(/^\d{6,8}$/) }).strict();

export async function POST(request: Request) {
  return withApiGuard(request, "auth", async () => {
    const { email, token } = input.parse(await readBoundedJson(request, 1024));
    await verifyEmailCode(email, token);
    return Response.json({ signedIn: true });
  });
}
