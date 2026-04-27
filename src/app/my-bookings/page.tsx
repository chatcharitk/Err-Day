import MyBookingsClient from "./MyBookingsClient";

export const dynamic = "force-dynamic";

/**
 * /my-bookings — customer self-service page.
 * Customer signs in with LINE; we fetch their bookings by lineUserId
 * and let them reschedule (date / time / branch) or cancel.
 */
export default function MyBookingsPage() {
  return <MyBookingsClient />;
}
