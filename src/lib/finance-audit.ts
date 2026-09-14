import type { Prisma } from "@/generated/prisma/client";
export function jsonSnapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}
