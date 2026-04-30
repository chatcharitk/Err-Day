import MembershipManager from "./MembershipManager";

export const dynamic = "force-dynamic";

export default function MembershipPage() {
  // Data is loaded client-side in MembershipManager
  return <MembershipManager />;
}
