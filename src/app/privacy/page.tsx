import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PDPA_VERSION } from "@/lib/pdpa";

export const metadata = {
  title: "นโยบายความเป็นส่วนตัว — err.day",
};

const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const PRIMARY = "#8B1D24";
const BORDER  = "#E8D8CC";
const BG      = "#FDF7F2";

function Section({ no, title, children }: { no: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold flex items-baseline gap-2" style={{ color: PRIMARY }}>
        <span className="text-xs" style={{ color: MUTED }}>{no}.</span>
        {title}
      </h2>
      <div className="text-sm leading-relaxed space-y-2" style={{ color: TEXT }}>
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen" style={{ background: BG }}>
      <div className="max-w-2xl mx-auto px-5 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm mb-6"
          style={{ color: MUTED }}
        >
          <ArrowLeft size={14} />
          กลับหน้าแรก
        </Link>

        <header className="mb-8">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Privacy Policy</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>นโยบายความเป็นส่วนตัว</h1>
          <p className="text-xs mt-2" style={{ color: MUTED }}>
            เวอร์ชัน {PDPA_VERSION} · สอดคล้องกับ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
          </p>
        </header>

        <div className="rounded-2xl bg-white p-6 space-y-6" style={{ border: `1.5px solid ${BORDER}` }}>
          <p className="text-sm" style={{ color: TEXT }}>
            err.day Salon ("เรา") ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของท่าน
            นโยบายฉบับนี้อธิบายวิธีที่เราเก็บ ใช้ และเปิดเผยข้อมูลของท่านเมื่อใช้บริการของเรา
          </p>

          <Section no={1} title="ข้อมูลที่เราเก็บ">
            <ul className="list-disc list-inside space-y-1">
              <li>ชื่อ-นามสกุล, เพศ</li>
              <li>เบอร์โทรศัพท์, อีเมล</li>
              <li>Line User ID (กรณีเชื่อมต่อผ่าน LINE)</li>
              <li>ประวัติการจองและการใช้บริการ</li>
              <li>ประวัติการชำระเงิน (ผ่านระบบ POS หน้าร้าน)</li>
            </ul>
          </Section>

          <Section no={2} title="วัตถุประสงค์ในการเก็บข้อมูล">
            <ul className="list-disc list-inside space-y-1">
              <li>เพื่อยืนยันการจองและติดต่อนัดหมาย</li>
              <li>เพื่อจัดการสถานะสมาชิกและสิทธิประโยชน์</li>
              <li>เพื่อส่งข้อมูลโปรโมชั่นและข่าวสาร (เฉพาะกรณีที่ท่านยินยอม)</li>
              <li>เพื่อวิเคราะห์และพัฒนาคุณภาพการให้บริการ</li>
              <li>เพื่อปฏิบัติตามกฎหมายและข้อบังคับที่เกี่ยวข้อง</li>
            </ul>
          </Section>

          <Section no={3} title="การเปิดเผยข้อมูล">
            <p>
              เราจะไม่เปิดเผย ขาย หรือถ่ายโอนข้อมูลส่วนบุคคลของท่านให้แก่บุคคลภายนอก
              ยกเว้นในกรณีดังต่อไปนี้:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>ผู้ให้บริการระบบที่ทำงานในนามของเรา (เช่น ผู้ให้บริการคลาวด์, LINE OA)</li>
              <li>เมื่อได้รับคำขอตามกฎหมายจากหน่วยงานที่มีอำนาจ</li>
              <li>เมื่อท่านให้ความยินยอมโดยชัดแจ้ง</li>
            </ul>
          </Section>

          <Section no={4} title="ระยะเวลาในการเก็บข้อมูล">
            <p>
              เราจะเก็บข้อมูลของท่านไว้เป็นระยะเวลา <strong>5 ปี</strong> นับจากวันที่ใช้บริการครั้งสุดท้าย
              หรือจนกว่าท่านจะขอให้เราลบข้อมูล (เลือกอย่างใดอย่างหนึ่งที่สั้นกว่า)
            </p>
          </Section>

          <Section no={5} title="สิทธิของท่าน">
            <p>ท่านมีสิทธิ์ตามกฎหมาย PDPA ดังนี้:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>ขอดู / ขอสำเนาข้อมูลของท่าน</li>
              <li>ขอให้แก้ไขข้อมูลที่ไม่ถูกต้องหรือไม่เป็นปัจจุบัน</li>
              <li>ขอให้ลบหรือทำลายข้อมูล</li>
              <li>คัดค้านหรือระงับการประมวลผลข้อมูล</li>
              <li>เพิกถอนความยินยอมเมื่อใดก็ได้</li>
              <li>ร้องเรียนต่อสำนักงานคุ้มครองข้อมูลส่วนบุคคล</li>
            </ul>
          </Section>

          <Section no={6} title="การรักษาความปลอดภัย">
            <p>
              เราใช้มาตรการทางเทคนิคและการจัดการที่เหมาะสมเพื่อปกป้องข้อมูล รวมถึงการเข้ารหัส
              การจำกัดสิทธิ์การเข้าถึง และการสำรองข้อมูลอย่างสม่ำเสมอ
            </p>
          </Section>

          <Section no={7} title="ติดต่อเรา">
            <p>หากมีคำถามหรือต้องการใช้สิทธิ์ของท่าน:</p>
            <ul className="list-none space-y-1 mt-1">
              <li>📧 <strong>privacy@err-daysalon.com</strong></li>
              <li>📞 ที่หน้าร้าน err.day Salon ทุกสาขา</li>
            </ul>
          </Section>

          <p className="text-xs pt-4 border-t" style={{ color: MUTED, borderColor: BORDER }}>
            นโยบายฉบับนี้อาจมีการแก้ไขเป็นครั้งคราว เราจะแจ้งให้ท่านทราบเมื่อมีการเปลี่ยนแปลงที่สำคัญ
            และจะขอความยินยอมใหม่เมื่อจำเป็น
          </p>
        </div>
      </div>
    </main>
  );
}
