import { createClient } from '@supabase/supabase-js';

let client = null;

export function isSupabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export function getSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase non configuré. Ajoutez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (voir .env.example).'
    );
  }

  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }

  return client;
}
