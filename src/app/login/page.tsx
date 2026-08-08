import { redirect } from "next/navigation";
import Image from "next/image";
import { SubmitButton } from "@/components/submit-button";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getHrmsAuth } from "@/lib/auth";
import { signOut } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams?: { next?: string; reason?: string } }) {
  const client = createServerSupabaseClient();
  const { data } = client ? await client.auth.getUser() : { data: { user: null } };
  const hrmsAuth = data.user ? await getHrmsAuth() : null;

  // Only enter the app when HRMS access is granted. Otherwise stay here with Sign out
  // (avoids login ↔ dashboard redirect loop).
  if (data.user && hrmsAuth) {
    const next = searchParams?.next;
    redirect(next && next.startsWith("/") ? next : "/");
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
        {data.user ? (
          <>
            <p className="auth-copy">
              Signed in as <strong>{data.user.email}</strong>, but this account is not linked for HRMS yet.
              Ask an admin to grant access, then sign out and sign in again.
            </p>
            <form action={signOut}>
              <SubmitButton className="button secondary full" pendingLabel="Signing out…">Sign out</SubmitButton>
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
