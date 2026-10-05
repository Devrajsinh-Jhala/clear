import { readBoundedJson } from "@/src/lib/security/limits/body";
import { withApiGuard } from "@/src/lib/api/guard";
import { assertSameOrigin, errorResponse } from "@/src/lib/api/http";
import { connectProvider, listPublicCredentials, removeProvider } from "@/src/lib/ai/credential-service";
import { BYOK_PROVIDERS } from "@/src/lib/ai/byok";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const connectSchema = z.object({
  provider: z.enum(BYOK_PROVIDERS.map((item) => item.id) as ["gemini", "openai", "anthropic", "xai", "compatible"]),
  apiKey: z.string().trim().min(8).max(400),
  model: z.string().trim().min(1).max(80),
  baseUrl: z.string().trim().max(200).optional(),
});

export async function GET(request: Request) {
  return withApiGuard(request, "mutation", async () => {
    try {
      const connected = await listPublicCredentials();
      return Response.json({
        clearFree: Boolean(process.env.GEMINI_API_KEY) && process.env.CLEAR_PROVIDER !== "mock",
        connected,
      });
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function POST(request: Request) {
  return withApiGuard(request, "provider-test", async () => {
    try {
      assertSameOrigin(request);
      const input = connectSchema.parse(await readBoundedJson(request));
      const connected = await connectProvider(input);
      return Response.json({ connected });
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function DELETE(request: Request) {
  return withApiGuard(request, "provider-test", async () => {
    try {
      assertSameOrigin(request);
      const provider = new URL(request.url).searchParams.get("provider") ?? "";
      await removeProvider(provider);
      return Response.json({ ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  });
}
