import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/lib/supabase/admin";

type EmailConfig = { from: string; host: string; pass: string | null; port: number; secure: boolean; user: string | null };

function envConfig(): EmailConfig {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim() || null;
  const pass = process.env.SMTP_PASS?.trim() || null;
  const from = process.env.SMTP_FROM?.trim() || process.env.EMAIL_FROM?.trim() || user;
  if (!host || !from) throw new Error("Email delivery is not configured. Configure company SMTP or SMTP environment variables.");
  const port = Number(process.env.SMTP_PORT ?? 587);
  return { from, host, pass, port, secure: String(process.env.SMTP_SECURE).toLowerCase() === "true" || port === 465, user };
}

async function companyConfig(companyId: string): Promise<EmailConfig | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.from("email_notification_settings")
    .select("is_enabled, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from, from_name")
    .eq("company_id", companyId).maybeSingle();
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("does not exist") || message.includes("schema cache")) return null;
    throw new Error(error.message);
  }
  if (!data?.is_enabled || !data.smtp_host) return null;
  const address = String(data.smtp_from || data.smtp_user || "").trim();
  if (!address) throw new Error("Company SMTP from address is missing.");
  const display = String(data.from_name || "").replace(/"/g, "").trim();
  return {
    from: display ? `"${display}" <${address}>` : address,
    host: data.smtp_host,
    pass: data.smtp_pass || null,
    port: Number(data.smtp_port ?? 587),
    secure: Boolean(data.smtp_secure),
    user: data.smtp_user || null
  };
}

export async function sendEmail(input: { body: string; cc?: string[]; companyId: string; subject: string; to: string[] }) {
  const to = Array.from(new Set(input.to.map((value) => value.trim().toLowerCase()).filter(Boolean)));
  const cc = Array.from(new Set((input.cc ?? []).map((value) => value.trim().toLowerCase()).filter((value) => value && !to.includes(value))));
  if (!to.length) throw new Error("No notification recipients were resolved.");
  const config = await companyConfig(input.companyId) ?? envConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465 || (config.secure && config.port !== 587),
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined
  });
  await transporter.sendMail({ from: config.from, to, cc: cc.length ? cc : undefined, subject: input.subject, text: input.body });
}
