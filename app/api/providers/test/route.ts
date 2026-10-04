import { z } from "zod";

import { assertSameOrigin, errorResponse } from "@/src/lib/api/http";
import { testSavedProvider } from "@/src/lib/ai/credential-service";
import { BYOK_PROVIDERS } from "@/src/lib/ai/byok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const testSchema = z.object({
  provider: z.enum(BYOK_PROVIDERS.map((item) => item.id) as ["gemini", "openai", "anthropic", "xai", "compatible"]),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = testSchema.parse(await request.json());
    await testSavedProvider(input.provider);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
