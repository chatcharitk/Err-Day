import { prisma } from "@/lib/prisma";
import MobileSettings from "./MobileSettings";

export const revalidate = 30;
export const metadata   = { title: "ตั้งค่าร้าน — err.day" };

export default async function MobileSettingsPage() {
  const branches = await prisma.branch.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, address: true, phone: true,
      openTime: true, closeTime: true, mapUrl: true,
      bookingEnabled: true, onlineCap: true,
    },
  });
  return <MobileSettings branches={branches} />;
}
