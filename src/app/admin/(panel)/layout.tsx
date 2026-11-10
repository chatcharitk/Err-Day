import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import AdminSidebar from "../AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentAdmin();
  if (!me) redirect("/admin/login");

  return (
    // Sidebar and content scroll separately (content in <main>), so sticky
    // headers and the chat composer on shared phone screens stay pinned.
    <div className="h-screen flex overflow-hidden print:block print:h-auto print:overflow-visible" style={{ backgroundColor: "#FDF8F3" }}>
      <AdminSidebar role={me.role} name={me.name} />
      <main className="flex-1 overflow-auto print:overflow-visible">{children}</main>
    </div>
  );
}
