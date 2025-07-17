import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Returns a singleton Supabase client.
 * If the required env-vars are missing (e.g. in a public preview)
 * we fall back to a mock client that simply returns empty data.
 */
let cached: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    console.warn("⚠️  Supabase env vars are not configured. " + "Using a mock client so the UI can still render.")

    // a lightweight mock that supports the chained calls used in data helpers
    // `.select()` immediately resolves to an object containing `data` and `error`,
    // but also exposes `.single()` and `.limit()` for further chaining.
    const mockSelectResult = {
      data: [] as unknown[],
      error: null,
      limit() {
        return this
      },
      single: async () => ({ data: null, error: null }),
    }

    const mockBuilder = {
      select() {
        return mockSelectResult
      },
      // convenience if someone calls .single() directly after .from()
      single: async () => ({ data: null, error: null }),
      limit() {
        return this
      },
      eq() {
        return this
      }, // Added for .eq()
      update() {
        return this
      }, // Added for .update()
      insert() {
        return this
      }, // Added for .insert()
    }
    cached = {
      from: () => mockBuilder,
    } as unknown as SupabaseClient

    return cached
  }

  cached = createClient(url, anon)
  return cached
}
