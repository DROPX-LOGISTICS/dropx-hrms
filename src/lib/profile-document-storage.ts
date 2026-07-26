import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const PROFILE_DOCUMENT_BUCKET = "employee-profile-documents";
export type ProfileDocumentOwnerType = "employee" | "contractor";

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_") || "profile-document";
}

function uploadedFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

export async function uploadProfileDocument({
  companyId,
  documentKey,
  ownerId,
  ownerType,
  fileValue
}: {
  companyId: string;
  documentKey: string;
  ownerId: string;
  ownerType: ProfileDocumentOwnerType;
  fileValue: FormDataEntryValue | null;
}) {
  if (!supabaseAdmin || !uploadedFile(fileValue)) return null;
  const path = `${companyId}/${ownerType}/${ownerId}/${documentKey}/${Date.now()}-${randomUUID()}-${safeFileName(fileValue.name)}`;
  const { error } = await supabaseAdmin.storage.from(PROFILE_DOCUMENT_BUCKET).upload(
    path,
    Buffer.from(await fileValue.arrayBuffer()),
    { contentType: fileValue.type || "application/octet-stream", upsert: false }
  );
  if (error) throw new Error(error.message);
  return path;
}

export async function replaceProfileDocument({
  companyId,
  documentLabel,
  ownerId,
  ownerType,
  existingPath,
  replacedBy
}: {
  companyId: string;
  documentLabel: string;
  ownerId: string;
  ownerType: ProfileDocumentOwnerType;
  existingPath: string | null;
  replacedBy: string;
}) {
  if (!supabaseAdmin || !existingPath) return;
  const now = new Date();
  const { error } = await supabaseAdmin.from("profile_document_trash").insert({
    company_id: companyId,
    owner_type: ownerType,
    owner_id: ownerId,
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

export function uploadEmployeeProfileDocument(input: {
  companyId: string;
  documentKey: string;
  employeeId: string;
  fileValue: FormDataEntryValue | null;
}) {
  return uploadProfileDocument({
    companyId: input.companyId,
    documentKey: input.documentKey,
    ownerId: input.employeeId,
    ownerType: "employee",
    fileValue: input.fileValue
  });
}

export function replaceEmployeeProfileDocument(input: {
  companyId: string;
  documentLabel: string;
  employeeId: string;
  existingPath: string | null;
  replacedBy: string;
}) {
  return replaceProfileDocument({
    companyId: input.companyId,
    documentLabel: input.documentLabel,
    ownerId: input.employeeId,
    ownerType: "employee",
    existingPath: input.existingPath,
    replacedBy: input.replacedBy
  });
}
