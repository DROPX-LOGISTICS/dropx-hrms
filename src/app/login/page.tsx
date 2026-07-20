import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signInWithGoogle } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams?: { next?: string; reason?: string } }) {
  const client = createServerSupabaseClient();
  const { data } = client ? await client.auth.getUser() : { data: { user: null } };
  if (data.user) redirect("/");
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark" aria-hidden="true">DX</div>
        <p className="eyebrow">DropX Logistics</p>
        <h1>People operations, in one place.</h1>
        <p className="auth-copy">Secure HRMS for employees, attendance, leave and approvals.</p>
        {searchParams?.reason ? <div className="alert error" role="alert">{searchParams.reason}</div> : null}
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={searchParams?.next ?? "/"} />
          <button className="button primary full" type="submit">Continue with Google</button>
        </form>
        <p className="fine-print">Only authorised DropX accounts can continue.</p>
      </section>
    </main>
  );
}
