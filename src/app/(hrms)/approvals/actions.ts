"use server";

import { revalidatePath } from "next/cache";
import { requireHrmsAuth } from "@/lib/auth";
import { actionError, actionSuccess, type ActionFeedbackState } from "@/lib/action-feedback";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function reviewLeave(_prev: ActionFeedbackState, formData: FormData): Promise<ActionFeedbackState> {
  const auth = await requireHrmsAuth("leave.approve");
  if (!supabaseAdmin) return actionError("Database configuration is missing.");
  const requestId = String(formData.get("request_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const reviewerNote = String(formData.get("reviewer_note") ?? "").trim();
  if (!requestId || !["approved", "rejected"].includes(decision)) return actionError("Invalid approval action.");
  const { data, error } = await supabaseAdmin.from("hr_leave_requests").update({ status: decision, reviewed_by: auth.userId, reviewed_at: new Date().toISOString(), reviewer_note: reviewerNote || null }).eq("company_id", auth.companyId).eq("id", requestId).eq("status", "pending").select("id").maybeSingle();
  if (error) return actionError(error.message);
  if (!data) return actionError("Request was already reviewed.");
  revalidatePath("/");
  revalidatePath("/leave");
  revalidatePath("/approvals");
  return actionSuccess(`Request ${decision}.`);
}
