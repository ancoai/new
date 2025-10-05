import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const PASSWORD_SALT = "thinking-chat-password";
const ENCRYPTION_SALT = "thinking-chat-encryption";
const IV_LENGTH = 12; // AES-GCM recommended IV length

function resolveSecret() {
  const secret = process.env.APP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (secret && secret.length >= 8) {
    return secret;
  }
  // Fallback for local development; callers should ensure a strong secret in production deployments.
  return "development-secret";
}

function getEncryptionKey() {
  const secret = resolveSecret();
  return scryptSync(secret, ENCRYPTION_SALT, 32);
}

export function hashPassword(password: string): string {
  const key = scryptSync(password, PASSWORD_SALT, 64);
  return key.toString("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  const computed = hashPassword(password);
  const hashBuffer = Buffer.from(hash, "hex");
  const computedBuffer = Buffer.from(computed, "hex");
  if (hashBuffer.length !== computedBuffer.length) {
    return false;
  }
  return timingSafeEqual(hashBuffer, computedBuffer);
}

export function encryptSecret(value: string): { cipherText: string; iv: string; authTag: string } {
  const iv = randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    cipherText: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptSecret(payload: { cipherText?: string | null; iv?: string | null; authTag?: string | null }): string | null {
  if (!payload.cipherText || !payload.iv || !payload.authTag) {
    return null;
  }
  const key = getEncryptionKey();
  const iv = Buffer.from(payload.iv, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.cipherText, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
