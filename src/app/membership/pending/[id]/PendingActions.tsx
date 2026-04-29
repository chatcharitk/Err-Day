"use client";

import Link from "next/link";
import { Search } from "lucide-react";

const PRIMARY = "#8B1D24";
const BORDER  = "#E8D8CC";

export default function PendingActions({ phone }: { phone: string }) {
  return (
    <Link
      href={`/membership/lookup?phone=${encodeURIComponent(phone)}`}
      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 text-sm font-semibold transition-colors hover:bg-stone-50"
      style={{ borderColor: PRIMARY, color: PRIMARY, background: "white" }}
    >
      <Search size={15} />
      เช็กสถานะหลังชำระแล้ว
    </Link>
  );
}
