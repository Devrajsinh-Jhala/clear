import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const NONCE_BYTES = 12;

export type EncryptedSecret = {
  ciphertext: string;
  nonce: string;
  authTag: string;
};

export function decodeEncryptionKey(encoded: string): Buffer {
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must be 32 bytes of base64.");
  }
  return key;
}

export function encryptSecret(plaintext: string, key: Buffer): EncryptedSecret {
  if (key.length !== 32) {
    throw new Error("Encryption key must be 32 bytes.");
  }
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64"),
    nonce: nonce.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(secret: EncryptedSecret, key: Buffer): string {
  if (key.length !== 32) {
    throw new Error("Encryption key must be 32 bytes.");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(secret.nonce, "base64"),
  );
  decipher.setAuthTag(Buffer.from(secret.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

export function maskedSuffix(secret: string): string {
  const suffix = secret.slice(-4);
  return suffix ? `••••${suffix}` : "••••";
}

export function secretsMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
