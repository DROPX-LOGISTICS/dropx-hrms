"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function reviewLeave(formData: FormData) {
  const auth = await requireHrmsAuth("leave.approve");
  if (!supabaseAdmin) redirect("/approvals?error=Database%20configuration%20is%20missing");
  const requestId = String(formData.get("request_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const reviewerNote = String(formData.get("reviewer_note") ?? "").trim();
  if (!requestId || !["approved", "rejected"].includes(decision)) redirect("/approvals?error=Invalid%20approval%20action");
  const { data, error } = await supabaseAdmin.from("hr_leave_requests").update({ status: decision, reviewed_by: auth.userId, reviewed_at: new Date().toISOString(), reviewer_note: reviewerNote || null }).eq("company_id", auth.companyId).eq("id", requestId).eq("status", "pending").select("id").maybeSingle();
  if (error) redirect(`/approvals?error=${encodeURIComponent(error.message)}`);
  if (!data) redirect("/approvals?error=Request%20was%20already%20reviewed");
  revalidatePath("/"); revalidatePath("/leave"); revalidatePath("/approvals");
  redirect(`/approvals?notice=Request%20${decision}`);
}
