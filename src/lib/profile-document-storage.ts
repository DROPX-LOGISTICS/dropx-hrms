import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const PROFILE_DOCUMENT_BUCKET = "employee-profile-documents";

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_") || "profile-document";
}

function uploadedFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

export async function uploadEmployeeProfileDocument({
  companyId,
  documentKey,
  employeeId,
  fileValue
}: {
  companyId: string;
  documentKey: string;
  employeeId: string;
  fileValue: FormDataEntryValue | null;
}) {
  if (!supabaseAdmin || !uploadedFile(fileValue)) return null;
  const path = `${companyId}/employee/${employeeId}/${documentKey}/${Date.now()}-${randomUUID()}-${safeFileName(fileValue.name)}`;
  const { error } = await supabaseAdmin.storage.from(PROFILE_DOCUMENT_BUCKET).upload(
    path,
    Buffer.from(await fileValue.arrayBuffer()),
    { contentType: fileValue.type || "application/octet-stream", upsert: false }
  );
  if (error) throw new Error(error.message);
  return path;
}

export async function replaceEmployeeProfileDocument({
  companyId,
  documentLabel,
  employeeId,
  existingPath,
  replacedBy
}: {
  companyId: string;
  documentLabel: string;
  employeeId: string;
  existingPath: string | null;
  replacedBy: string;
}) {
  if (!supabaseAdmin || !existingPath) return;
  const now = new Date();
  const { error } = await supabaseAdmin.from("profile_document_trash").insert({
    company_id: companyId,
    owner_type: "employee",
    owner_id: employeeId,
    document_label: documentLabel,
    file_name: existingPath.split("/").pop(),
    storage_bucket: PROFILE_DOCUMENT_BUCKET,
    storage_path: existingPath,
    replaced_by: replacedBy,
    replaced_at: now.toISOString(),
    delete_after: new Date(now.getTime() + 30 * 86_400_000).toISOString()
  });
  if (!error) return;
  const message = error.message.toLowerCase();
  if (message.includes("profile_document_trash") || message.includes("does not exist") || message.includes("schema cache")) {
    const removed = await supabaseAdmin.storage.from(PROFILE_DOCUMENT_BUCKET).remove([existingPath]);
    if (removed.error) throw new Error(removed.error.message);
    return;
  }
  throw new Error(error.message);
}
