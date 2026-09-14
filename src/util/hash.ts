import { createHash } from "node:crypto";

export function hashPayload(payload: unknown): string {
  const stable = JSON.stringify(payload, Object.keys(payload as object).sort());
  return createHash("sha256").update(stable).digest("hex");
}
