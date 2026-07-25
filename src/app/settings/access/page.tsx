import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { hrmsRoles } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { saveHrmsUserAccess } from "./actions";

export const metadata: Metadata = { title: "Users & Access" };
export const dynamic = "force-dynamic";

type AccessPageProps = {
  searchParams?: { error?: string; notice?: string };
};

export default async function HrmsAccessPage({ searchParams }: AccessPageProps) {
  const auth = await requireHrmsAuth("settings.manage");
  const [profilesResult, accessResult] = supabaseAdmin ? await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, location_scope_ids, is_active, is_master_owner")
      .eq("company_id", auth.companyId)
      .order("full_name"),
    supabaseAdmin
      .from("hr_user_access")
      .select("user_id, role_code, all_locations, is_active")
      .eq("company_id", auth.companyId)
  ]) : [{ data: [], error: { message: "Database configuration is missing." } }, { data: [], error: null }];

  const accessByUser = new Map((accessResult.data ?? []).map((row) => [row.user_id, row]));
  const profiles = profilesResult.data ?? [];
  const error = profilesResult.error?.message ?? accessResult.error?.message ?? searchParams?.error;

  return <AppShell auth={auth} active="Users & Access">
    <PageHeader
      eyebrow="People administration"
      title="Users & Access"
      description="Manage People/HRMS access here. Dashboard and Ops permissions are intentionally not shown or changed."
    />

    {error || searchParams?.notice ? <section className="panel access-message"><div className="panel-body">
      <strong>{error ? "Unable to save access" : "Access updated"}</strong>
      <p>{error ?? searchParams?.notice}</p>
    </div></section> : null}

    <section className="panel">
      <div className="panel-head">
        <div><h2>People users</h2><p className="panel-subtitle">{profiles.length} company identities · HRMS roles are independent from Dashboard and Ops.</p></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>User</th><th>People role</th><th>Location access</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {profiles.map((profile) => {
              const access = accessByUser.get(profile.id);
              const isOwner = Boolean(profile.is_master_owner) || String(profile.role).toUpperCase() === "OWNER";
              return <tr key={profile.id}>
                <td><strong>{profile.full_name || profile.email}</strong><small className="access-user-email">{profile.email}</small></td>
                <td colSpan={4}>
                  {isOwner ? <div className="owner-access-row"><span>Owner</span><span>All locations</span><span className="status-pill active">Active</span><small>Protected master access</small></div> :
                  <form action={saveHrmsUserAccess} className="access-row-form">
                    <input name="user_id" type="hidden" value={profile.id} />
                    <select className="select" name="role_code" defaultValue={access?.role_code ?? "VIEWER"}>
                      {hrmsRoles.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}
                    </select>
                    <label className="access-check"><input name="all_locations" type="checkbox" defaultChecked={Boolean(access?.all_locations)} /> All locations</label>
                    <select className="select" name="is_active" defaultValue={access?.is_active ? "active" : "inactive"}>
                      <option value="active">Active</option>
                      <option value="inactive">No HRMS access</option>
                    </select>
                    <SubmitButton className="button primary small" pendingLabel="Saving…">Save</SubmitButton>
                  </form>}
                </td>
              </tr>;
            })}
            {!profiles.length ? <tr><td colSpan={5}>No company users found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  </AppShell>;
}
