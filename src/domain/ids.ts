import { createHash, randomUUID } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function stableId(prefix: string, parts: Array<string | null | undefined>): string {
  const hash = createHash("sha256")
    .update(parts.filter(Boolean).join("|").toLowerCase())
    .digest("hex")
    .slice(0, 24);

  return `${prefix}_${hash}`;
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
