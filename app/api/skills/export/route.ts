import { ZodError } from "zod";

import { ClearError, toErrorBody } from "@/src/lib/api/errors";
import { assertSameOrigin } from "@/src/lib/api/http";
import { buildSkillFiles } from "@/src/lib/skill/generate";
import { createSkillZip } from "@/src/lib/skill/package";
import { skillExportInputSchema } from "@/src/lib/skill/preferences";
import { readSkillResources } from "@/src/lib/skill/resources";

export const runtime = "nodejs";

const ERROR_HEADERS = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const origin = request.headers.get("origin");
    const requestUrl = new URL(request.url);
    const expectedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? requestUrl.host;
    const expectedProtocol = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
    let validOrigin = true;
    if (origin) {
      try {
        validOrigin = new URL(origin).origin === `${expectedProtocol}://${expectedHost}`;
      } catch {
        validOrigin = false;
      }
    }
    if (request.headers.get("sec-fetch-site") === "cross-site" || !validOrigin) {
      throw new ClearError("forbidden", "Open the skill page on CLEAR and try the download again.", { status: 403 });
    }

    if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
      throw new ClearError("invalid_request", "Send the skill preferences as JSON and try again.", { status: 400 });
    }
    const body = await request.text();
    if (body.length > 4096) {
      throw new ClearError("invalid_request", "The skill preferences are too large. Reset them and try again.", { status: 413 });
    }
    const input = skillExportInputSchema.parse(JSON.parse(body));
    const files = buildSkillFiles(input.preferences, await readSkillResources());
    const zip = createSkillZip(files);
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="clear-explainer.zip"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Length": String(zip.byteLength),
      },
    });
  } catch (error) {
    if (error instanceof ClearError) {
      return Response.json(toErrorBody(error), { status: error.status, headers: ERROR_HEADERS });
    }
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return Response.json({
        error: { code: "invalid_request", message: "Choose valid skill preferences and try the download again.", retryable: false },
      }, { status: 400, headers: ERROR_HEADERS });
    }
    return Response.json({
      error: { code: "skill_export_failed", message: "The skill package could not be prepared. Please try again.", retryable: true },
    }, { status: 500, headers: ERROR_HEADERS });
  }
}
