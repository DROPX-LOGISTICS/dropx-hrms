import type { Metadata } from "next";

import { AccessRowForm } from "@/components/access-row-form";

import { PageHeader } from "@/components/page-header";

import { requireHrmsAuth } from "@/lib/auth";

import { supabaseAdmin } from "@/lib/supabase/admin";



export const metadata: Metadata = { title: "Users & Access" };



export default async function HrmsAccessPage() {

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

  const loadError = profilesResult.error?.message ?? accessResult.error?.message;



  return <>

    <PageHeader

      eyebrow="People administration"

      title="Users & Access"

      description="Manage People/HRMS access here. Dashboard and Ops permissions are intentionally not shown or changed."

    />



    {loadError ? <section className="panel access-message"><div className="panel-body">

      <strong>Unable to load access</strong>

      <p>{loadError}</p>

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

                  <AccessRowForm

                    userId={profile.id}

                    roleCode={access?.role_code ?? "VIEWER"}

                    allLocations={Boolean(access?.all_locations)}

                    isActive={Boolean(access?.is_active)}

                  />}

                </td>

              </tr>;

            })}

            {!profiles.length ? <tr><td colSpan={5}>No company users found.</td></tr> : null}

          </tbody>

        </table>

      </div>

    </section>

  </>;

}

