import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/staff-auth";
import { myClockToday } from "@/lib/clock";
import StaffHeader from "../StaffHeader";
import StaffNav from "../StaffNav";
import ClockScanner from "./ClockScanner";

export const dynamic  = "force-dynamic"; // cookie-dependent
export const metadata = { title: "ลงเวลา — err.day" };

export default async function StaffClockPage() {
  const me = await getCurrentStaff();
  if (!me) redirect("/staff/login");
  const today = await myClockToday(me.id);
  return (
    <main className="min-h-screen pb-12" style={{ background: "#FDF8F3" }}>
      <StaffHeader name={me.name} subtitle={me.branchName} />
      <StaffNav active="clock" />
      <ClockScanner initial={today} />
    </main>
  );
}
