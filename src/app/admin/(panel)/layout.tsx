import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import AdminSidebar from "../AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentAdmin();
  if (!me) redirect("/admin/login");

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#FDF8F3" }}>
      <AdminSidebar role={me.role} name={me.name} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
