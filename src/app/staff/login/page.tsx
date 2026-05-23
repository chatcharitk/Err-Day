import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/staff-auth";
import LoginForm from "./LoginForm";

export const dynamic  = "force-dynamic"; // cookie-dependent
export const metadata = { title: "เข้าสู่ระบบพนักงาน — err.day" };

export default async function StaffLoginPage() {
  // If already signed in, skip straight to dashboard
  const me = await getCurrentStaff();
  if (me) redirect("/staff");

  return <LoginForm />;
}
