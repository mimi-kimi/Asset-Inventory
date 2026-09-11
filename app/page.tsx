import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isMobileUA } from "@/lib/device";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  // Users created with a temporary password must set their own first.
  if (viewer.profile.must_change_password) redirect("/account");

  // Desktop lands on the dashboard; phones land on the mobile inspector app.
  const h = await headers();
  const ua = h.get("user-agent");
  redirect(isMobileUA(ua) ? "/mobile" : "/dashboard");
}
