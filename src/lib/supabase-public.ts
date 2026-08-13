'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * Browser-safe Supabase client (anon key only), used by the public storefront
 * pages to read the active product catalog. Row Level Security only allows
 * reading `products` where active = true and reading `stores` basic fields —
 * see supabase/schema.sql. All writes (orders, status changes) go through
 * the server API routes instead.
 */
let client: ReturnType<typeof createClient> | null = null;

export function getSupabasePublic() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY não configurados.'
    );
  }
  client = createClient(url, anonKey);
  return client;
}
