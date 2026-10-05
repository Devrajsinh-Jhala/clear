import { z } from "zod";

import { withApiGuard } from "@/src/lib/api/guard";
import { deleteAccountLesson, updateAccountLesson } from "@/src/lib/auth/library";
import { readBoundedJson } from "@/src/lib/security/limits/body";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), title: z.string().trim().min(1).max(160) }).strict(),
  z.object({ action: z.literal("favorite"), favorite: z.boolean() }).strict(),
  z.object({ action: z.literal("archive"), archived: z.boolean() }).strict(),
]);

export async function PATCH(request: Request, context: Context) {
  return withApiGuard(request, "mutation", async () => {
    const { id } = await context.params;
    await updateAccountLesson(id, input.parse(await readBoundedJson(request, 1024)));
    return Response.json({ updated: true });
  });
}

export async function DELETE(request: Request, context: Context) {
  return withApiGuard(request, "mutation", async () => {
    const { id } = await context.params;
    return Response.json(await deleteAccountLesson(id));
  });
}
