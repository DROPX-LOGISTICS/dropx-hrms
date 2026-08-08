import { AppShellLayout } from "@/components/app-shell-layout";
import { ClientRedirect } from "@/components/client-redirect";
import { getHrmsAuth, toClientAuth } from "@/lib/auth";

export default async function HrmsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const auth = await getHrmsAuth();
  // Do not use next/navigation redirect() here — it 500s on Cloudflare Workers for this app.
  if (!auth) return <ClientRedirect href="/login?reason=HRMS%20access%20is%20not%20configured" />;
  return <AppShellLayout auth={toClientAuth(auth)}>{children}</AppShellLayout>;
}
