import { prisma } from "@/lib/prisma";
import AddonsManager from "./AddonsManager";

export const revalidate = 30;
export const metadata   = { title: "บริการเสริม — err.day" };

export default async function AddonsPage() {
  const addons = await prisma.serviceAddon.findMany({
    orderBy: [{ isActive: "desc" }, { nameTh: "asc" }],
    select:  { id: true, name: true, nameTh: true, price: true, isActive: true },
  });

  return (
    <AddonsManager
      initial={addons.map(a => ({
        id:       a.id,
        name:     a.name,
        nameTh:   a.nameTh,
        price:    a.price,         // satang
        isActive: a.isActive,
      }))}
    />
  );
}
