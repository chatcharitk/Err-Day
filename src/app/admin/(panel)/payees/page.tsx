import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import PayeeManager from "@/components/PayeeManager";
import css from "@/components/Finance.module.css";
export const dynamic = "force-dynamic";
export default async function PayeesPage() {
  const me = await getCurrentAdmin();
  if (me?.role !== "OWNER") notFound();
  return (
    <main className={css.page}>
      <PayeeManager />
    </main>
  );
}
