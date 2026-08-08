import { AppShellLayout } from "@/components/app-shell-layout";
import { requireHrmsAuth, toClientAuth } from "@/lib/auth";

export default async function HrmsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const auth = await requireHrmsAuth();
  return <AppShellLayout auth={toClientAuth(auth)}>{children}</AppShellLayout>;
}
