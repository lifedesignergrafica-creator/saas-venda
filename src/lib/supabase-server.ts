import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client, using the service role key.
 * NEVER import this file from a 'use client' component — the service role
 * key bypasses Row Level Security and must stay on the server.
 */
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados. Veja .env.local.example.'
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
