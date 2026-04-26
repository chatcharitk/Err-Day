"use client";

import { useRouter } from "next/navigation";
import type { Branch } from "@/generated/prisma/client";

interface Props {
  branches: Branch[];
  currentBranchId: string | undefined;
}

export default function AdminActions({ branches, currentBranchId }: Props) {
  const router = useRouter();

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    router.push(val ? `/admin?branchId=${val}` : "/admin");
  };

  return (
    <div className="flex items-center gap-3 mb-6">
      <label className="text-sm text-stone-500 flex-shrink-0">Filter by branch:</label>
      <select
        value={currentBranchId ?? ""}
        onChange={handleBranchChange}
        className="border border-stone-200 rounded-md px-3 py-1.5 text-sm bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
      >
        <option value="">All branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  );
}
