import { createClient } from "@supabase/supabase-js";

// Public (publishable) Supabase credentials — same project the SyncOps build ships with.
// The dashboard gracefully falls back to mock data when these are unreachable.
const SUPABASE_URL = "https://xuxdkkjmgnvyfueooutd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lGDhV_0k3XP5rMsd9jPV0w_sCcZxhZa";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
