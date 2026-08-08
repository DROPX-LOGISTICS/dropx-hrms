import { AppShellLayout } from "@/components/app-shell-layout";
import { ClientRedirect } from "@/components/client-redirect";
import { getHrmsAuth, toClientAuth } from "@/lib/auth";

// Workers Builds (Linux CI) otherwise statically prerenders this tree; runtime cookies() then 500s with
// "Page changed from static to dynamic at runtime /, reason: cookies".
export const dynamic = "force-dynamic";

export default async function HrmsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  try {
    const auth = await getHrmsAuth();
    // Do not use next/navigation redirect() here — it 500s on Cloudflare Workers for this app.
    if (!auth) return <ClientRedirect href="/login?reason=HRMS%20access%20is%20not%20configured" />;
    return <AppShellLayout auth={toClientAuth(auth)}>{children}</AppShellLayout>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load HRMS session.";
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="auth-copy">Something went wrong loading your session.</p>
          <p className="fine-print">{message}</p>
          <p className="fine-print"><a href="/auth/signout">Sign out and try again</a></p>
        </section>
      </main>
    );
  }
}
