import { prisma } from "@/lib/prisma";

/**
 * Thai → English names for the lines of a receipt (services and add-ons), for the
 * English copy. Also covers the inner name of "ส่วนลด (…)" lines. Anything not
 * found — a typed-in special service — is simply absent and printed as typed.
 */
export async function englishNames(descriptions: string[]): Promise<Map<string, string>> {
  const texts = [...new Set(descriptions.flatMap(d => {
    const inner = d.match(/^ส่วนลด \((.+)\)$/)?.[1];
    return inner ? [d, inner] : [d];
  }))];
  const names = new Map<string, string>();
  if (texts.length === 0) return names;
  const [services, addons] = await Promise.all([
    prisma.service.findMany({ where: { nameTh: { in: texts } }, select: { nameTh: true, name: true } }),
    prisma.serviceAddon.findMany({ where: { nameTh: { in: texts } }, select: { nameTh: true, name: true } }),
  ]);
  for (const r of [...services, ...addons]) if (r.name) names.set(r.nameTh, r.name);
  return names;
}
