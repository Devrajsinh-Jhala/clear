import { createHmac } from "node:crypto";

import { ClearError } from "@/src/lib/api/errors";

/** Account UUIDs are public identifiers, unlike the opaque guest bearer cookie. */
export function accountLearnerId(userId: string): string {
  const secret = process.env.APP_ENCRYPTION_KEY;
  if (!secret || Buffer.from(secret, "base64").length !== 32) {
    throw new ClearError("storage_unavailable", "Account storage is temporarily unavailable. Please try again later.", { status: 503 });
  }
  const bytes = createHmac("sha256", secret).update(`clear-account-learner-v1:${userId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
