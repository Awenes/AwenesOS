import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`enc:${value}`, "utf8"),
    decryptString: (buffer: Buffer) =>
      buffer.toString("utf8").replace(/^enc:/, ""),
  },
}));

const { EncryptedSecretVault } = await import(
  "../desktop/encrypted-secret-vault.js"
);
const { safeStorage } = await import("electron");

describe("EncryptedSecretVault", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "awenes-vault-"));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips a secret through encryption", async () => {
    const vault = new EncryptedSecretVault(join(dir, "secrets.json"));
    await vault.set("provider:1", "sk-test-key");
    expect(await vault.get("provider:1")).toBe("sk-test-key");
  });

  it("returns null for a missing key", async () => {
    const vault = new EncryptedSecretVault(join(dir, "secrets.json"));
    expect(await vault.get("missing")).toBeNull();
  });

  it("deletes a stored secret", async () => {
    const vault = new EncryptedSecretVault(join(dir, "secrets.json"));
    await vault.set("k", "v");
    await vault.delete("k");
    expect(await vault.get("k")).toBeNull();
  });

  it("persists secrets across vault instances, keyed independently", async () => {
    const path = join(dir, "secrets.json");
    await new EncryptedSecretVault(path).set("provider:a", "key-a");
    const second = new EncryptedSecretVault(path);
    await second.set("provider:b", "key-b");
    expect(await second.get("provider:a")).toBe("key-a");
    expect(await second.get("provider:b")).toBe("key-b");
  });

  it("never writes the plaintext secret to disk", async () => {
    const path = join(dir, "secrets.json");
    await new EncryptedSecretVault(path).set("k", "super-secret-value");
    const raw = await readFile(path, "utf8");
    expect(raw).not.toContain("super-secret-value");
  });

  it("throws instead of storing a secret when Windows credential encryption is unavailable", async () => {
    vi.spyOn(safeStorage, "isEncryptionAvailable").mockReturnValue(false);
    const vault = new EncryptedSecretVault(join(dir, "secrets.json"));
    await expect(vault.set("k", "v")).rejects.toThrow(
      "Windows credential encryption is unavailable",
    );
  });

  it("throws instead of returning a stored secret when decryption becomes unavailable", async () => {
    const path = join(dir, "secrets.json");
    await new EncryptedSecretVault(path).set("k", "v");
    vi.spyOn(safeStorage, "isEncryptionAvailable").mockReturnValue(false);
    await expect(new EncryptedSecretVault(path).get("k")).rejects.toThrow(
      "Windows credential encryption is unavailable",
    );
  });
});
