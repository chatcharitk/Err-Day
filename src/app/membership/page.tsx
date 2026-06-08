import { redirect } from "next/navigation";

/**
 * /membership — entry point for the "สมาชิก" link in the customer nav.
 * New customers land here to sign up. Existing members can see their status
 * under /my-bookings.
 */
export default function MembershipPage() {
  redirect("/liff/membership/signup");
}
