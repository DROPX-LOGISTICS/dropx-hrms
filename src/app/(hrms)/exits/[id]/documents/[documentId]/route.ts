import { NextResponse } from "next/server";
import { getHrmsAuth } from "@/lib/auth";
import { readEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_: Request, { params }: { params: { id: string; documentId: string } }) {
  const auth = await getHrmsAuth();
  const appUrl = readEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
  if (!auth || !auth.permissions.has("exit.view") || !supabaseAdmin) return NextResponse.redirect(new URL("/login", appUrl));
  const { data } = await supabaseAdmin.from("hr_exit_documents").select("storage_path").eq("company_id", auth.companyId).eq("case_id", params.id).eq("id", params.documentId).neq("status", "void").maybeSingle();
  if (!data) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const signed = await supabaseAdmin.storage.from("hr-exit-documents").createSignedUrl(data.storage_path, 60);
  if (signed.error || !signed.data?.signedUrl) return NextResponse.json({ error: signed.error?.message ?? "Unable to create download link." }, { status: 400 });
  return NextResponse.redirect(signed.data.signedUrl);
}
