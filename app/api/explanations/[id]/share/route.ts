import { readBoundedJson } from "@/src/lib/security/limits/body";
import { withApiGuard } from "@/src/lib/api/guard";
import { z } from "zod";

import { ClearError } from "@/src/lib/api/errors";
import { assertShareWriteOrigin, noStore, shareErrorResponse } from "@/src/lib/sharing/http";
import { getShareStatus, publishShare, revokeShare } from "@/src/lib/sharing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({ showProvider: z.boolean() }).strict();
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  return withApiGuard(_request, "share", async () => {
    try {
      const { id } = await context.params;
      return noStore(Response.json({ share: await getShareStatus(id) }));
    } catch (error) { return shareErrorResponse(error); }
  });
}

export async function POST(request: Request, context: Context) {
  return withApiGuard(request, "share", async () => {
    try {
      assertShareWriteOrigin(request);
      if (!request.headers.get("content-type")?.includes("application/json")) {
        throw new ClearError("invalid_request", "Sharing options must be JSON.", { status: 415 });
      }
      const options = inputSchema.parse(await readBoundedJson(request, 256));
      const { id } = await context.params;
      return noStore(Response.json({ share: await publishShare(id, options) }));
    } catch (error) { return shareErrorResponse(error); }
  });
}

export async function DELETE(request: Request, context: Context) {
  return withApiGuard(request, "share", async () => {
    try {
      assertShareWriteOrigin(request);
      const { id } = await context.params;
      return noStore(Response.json({ share: await revokeShare(id) }));
    } catch (error) { return shareErrorResponse(error); }
  });
}
