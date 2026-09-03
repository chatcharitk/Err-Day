import { prisma } from "@/lib/prisma";
import SettingsManager from "./SettingsManager";

export const revalidate = 30;

export default async function SettingsPage() {
  const [branches, company] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, address: true, phone: true,
        openTime: true, closeTime: true,
        mapUrl: true, mapLat: true, mapLng: true,
        taxBranchCode: true,
      },
    }),
    // Seeded by the receipts migration; `?? null` keeps the screen usable even
    // if the row is somehow missing (the API recreates it on first save).
    prisma.companyProfile.findUnique({
      where: { id: "company" },
      select: {
        legalName: true, legalNameEn: true, taxId: true, addressLine: true,
        phone: true, vatRegistered: true, vatRatePercent: true, receiptFooterTh: true,
      },
    }),
  ]);

  return <SettingsManager branches={branches} company={company} />;
}
