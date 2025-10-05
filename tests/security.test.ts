import { decryptSecret, encryptSecret, hashPassword, verifyPassword } from "@/lib/security";

describe("security helpers", () => {
  it("encrypts and decrypts secrets symmetrically", () => {
    const encrypted = encryptSecret("super-secret");
    expect(encrypted.cipherText).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.authTag).toBeTruthy();

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe("super-secret");
  });

  it("verifies password hashes", () => {
    const hash = hashPassword("12345678");
    expect(hash).toHaveLength(128);
    expect(verifyPassword("12345678", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });
});
