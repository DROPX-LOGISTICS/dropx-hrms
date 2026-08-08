import Image from "next/image";
import { ClientRedirect } from "@/components/client-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getHrmsAuth } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams?: { next?: string; reason?: string } }) {
  const client = createServerSupabaseClient();
  let user = null as { email?: string | null } | null;
  try {
    const { data } = client ? await client.auth.getUser() : { data: { user: null } };
    user = data.user;
  } catch {
    user = null;
  }
  const hrmsAuth = user ? await getHrmsAuth() : null;

  // Only enter the app when HRMS access is granted. Otherwise stay here with Sign out
  // (avoids login ↔ dashboard redirect loop).
  if (user && hrmsAuth) {
    const next = searchParams?.next;
    const href = next && next.startsWith("/") ? next : "/";
    return <ClientRedirect href={href} />;
  }

  const nextPath = searchParams?.next && searchParams.next.startsWith("/") ? searchParams.next : "/";

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="login-brand">
          <Image className="login-logo" src="/dropx-logo.png" alt="DropX" width={154} height={58} priority />
          <span>People</span>
        </div>
        <p className="eyebrow">DropX Logistics</p>
        <h1>People operations, in one place.</h1>
        <p className="auth-copy">Secure HRMS for employees, attendance, leave and approvals.</p>
        {searchParams?.reason ? <div className="alert error" role="alert">{searchParams.reason}</div> : null}
        {user ? (
          <>
            <p className="auth-copy">
              Signed in as <strong>{user.email}</strong>, but this account is not linked for HRMS yet.
              Ask an admin to grant access, then sign out and sign in again.
            </p>
            <form action="/auth/signout" method="get">
              <button className="button secondary full" type="submit">Sign out</button>
            </form>
          </>
        ) : (
          <form action="/auth/google" method="get">
            <input type="hidden" name="next" value={nextPath} />
            <button className="button primary full" type="submit">Continue with Google</button>
          </form>
        )}
        <p className="fine-print">Only authorised DropX accounts can continue.</p>
      </section>
    </main>
  );
}
