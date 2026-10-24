/** Validate the product form. `partial` → only fields present are checked. */
export function parseProductInput(b: Record<string, unknown>, partial: boolean):
  { data: Record<string, unknown> } | { error: string } {
  const data: Record<string, unknown> = {};
  const has = (k: string) => k in b;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");

  if (!partial || has("name")) {
    if (!str("name")) return { error: "กรุณาใส่ชื่อสินค้า" };
    data.name = str("name");
  }
  for (const k of ["brand", "size", "packUnit", "notes", "imageUrl", "category"]) if (has(k)) data[k] = str(k) || null;
  if (!partial || has("unit")) data.unit = str("unit") || "ชิ้น";
  if (has("packSize")) {
    const n = Number(b.packSize);
    if (!Number.isInteger(n) || n < 1 || n > 1000) return { error: "จำนวนต่อแพ็คไม่ถูกต้อง" };
    data.packSize = n;
  }
  if (has("costBaht")) {
    if (b.costBaht === "" || b.costBaht == null) data.costSatang = null;
    else {
      const n = Number(b.costBaht);
      if (!Number.isFinite(n) || n < 0) return { error: "ราคาทุนไม่ถูกต้อง" };
      data.costSatang = Math.round(n * 100);
    }
  }
  if (!partial || has("usage")) {
    const u = str("usage") || "USE";
    if (!["USE", "SALE", "BOTH"].includes(u)) return { error: "ประเภทไม่ถูกต้อง" };
    data.usage = u;
  }
  if (has("serviceId")) data.serviceId = str("serviceId") || null;
  if (has("minQty")) {
    const n = Number(b.minQty || 0);
    if (!Number.isInteger(n) || n < 0) return { error: "จำนวนขั้นต่ำไม่ถูกต้อง" };
    data.minQty = n;
  }
  if (has("isActive")) data.isActive = !!b.isActive;
  return { data };
}
