import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "เข้าสู่ระบบแอดมิน — err.day" };
export const dynamic  = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
