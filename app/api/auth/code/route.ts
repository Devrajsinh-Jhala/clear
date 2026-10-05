import { z } from "zod";

import { withApiGuard } from "@/src/lib/api/guard";
import { requestEmailCode } from "@/src/lib/auth/service";
import { readBoundedJson } from "@/src/lib/security/limits/body";

export const runtime = "nodejs";
const input = z.object({ email: z.string().trim().email().max(254) }).strict();

export async function POST(request: Request) {
  return withApiGuard(request, "auth", async () => {
    const { email } = input.parse(await readBoundedJson(request, 1024));
    await requestEmailCode(email);
    return Response.json({ sent: true });
  });
}
