import { prisma } from "@/lib/prisma";
import SettingsManager from "./SettingsManager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, address: true, phone: true,
      openTime: true, closeTime: true,
      mapUrl: true, mapLat: true, mapLng: true,
    },
  });
  return <SettingsManager branches={branches} />;
}
