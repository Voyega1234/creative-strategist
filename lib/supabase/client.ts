import { createClient } from '@supabase/supabase-js'
import { StorageClient } from '@supabase/storage-js'

export const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

// Direct StorageClient following the official docs exactly
export const getStorageClient = () => 
  new StorageClient(`${process.env.NEXT_PUBLIC_SUPABASE_URL!}/storage/v1`, {
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
  })
