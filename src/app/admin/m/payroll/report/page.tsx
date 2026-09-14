import Link from "next/link";
import ReportPage from "@/app/admin/(panel)/payroll/report/page";

export const dynamic = "force-dynamic";
export const metadata = { title: "รายงานการทำงาน — err.day" };

export default async function MobileReportPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <>
      <nav className="px-4 py-3 print:hidden">
        <Link href="/admin/m/payroll">← ค่าตอบแทนพนักงาน</Link>
      </nav>
      <ReportPage {...props} />
    </>
  );
}
