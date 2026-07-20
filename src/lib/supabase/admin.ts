import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isAdminConfigured = Boolean(url && serviceRoleKey);

export const supabaseAdmin = isAdminConfigured
  ? createClient(url!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;
