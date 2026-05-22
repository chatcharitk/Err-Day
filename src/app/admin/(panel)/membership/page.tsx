import MembershipManager from "./MembershipManager";

export const revalidate = 30;

export default function MembershipPage() {
  // Data is loaded client-side in MembershipManager
  return <MembershipManager />;
}
