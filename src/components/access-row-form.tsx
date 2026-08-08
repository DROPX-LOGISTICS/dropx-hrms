"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { saveHrmsUserAccess } from "@/app/(hrms)/settings/access/actions";
import { hrmsRoles } from "@/lib/permissions";

export function AccessRowForm({
  userId,
  roleCode,
  allLocations,
  isActive
}: {
  userId: string;
  roleCode: string;
  allLocations: boolean;
  isActive: boolean;
}) {
  return (
    <ActionForm action={saveHrmsUserAccess} className="access-row-form">
      <input name="user_id" type="hidden" value={userId} />
      <select className="select" name="role_code" defaultValue={roleCode}>
        {hrmsRoles.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}
      </select>
      <label className="access-check"><input name="all_locations" type="checkbox" defaultChecked={allLocations} /> All locations</label>
      <select className="select" name="is_active" defaultValue={isActive ? "active" : "inactive"}>
        <option value="active">Active</option>
        <option value="inactive">No HRMS access</option>
      </select>
      <SubmitButton className="button primary small" pendingLabel="Saving…">Save</SubmitButton>
    </ActionForm>
  );
}
