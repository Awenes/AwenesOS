import { safeStorage } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { SecretVault } from "../src/domain/provider.js";

export class EncryptedSecretVault implements SecretVault {
  constructor(private readonly path: string) {}

  async set(key: string, value: string) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows credential encryption is unavailable");
    const values = await this.read(); values[key] = safeStorage.encryptString(value).toString("base64"); await this.write(values);
  }
  async get(key: string) {
    const encoded = (await this.read())[key];
    if (!encoded) return null;
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows credential encryption is unavailable");
    return safeStorage.decryptString(Buffer.from(encoded, "base64"));
  }
  async delete(key: string) { const values = await this.read(); delete values[key]; await this.write(values); }

  private async read(): Promise<Record<string, string>> {
    try { return JSON.parse(await readFile(this.path, "utf8")) as Record<string, string>; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}; throw error; }
  }
  private async write(values: Record<string, string>) {
    await mkdir(dirname(this.path), { recursive: true }); const temporary = `${this.path}.tmp`;
    await writeFile(temporary, JSON.stringify(values), { encoding: "utf8", mode: 0o600 }); await rename(temporary, this.path);
  }
}
