import { randomUUID } from "node:crypto"

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return null

  return {
    url: url.replace(/\/$/, ""),
    key,
  }
}

export async function selectFirst(table, filters, options = {}) {
  const config = getSupabaseConfig()
  if (!config) return null

  const params = new URLSearchParams()
  params.set("select", options.select || "*")
  params.set("limit", "1")

  for (const [column, value] of Object.entries(filters)) {
    if (value == null || value === "") continue
    params.set(column, `eq.${value}`)
  }

  const response = await fetch(`${config.url}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Supabase select failed for ${table}: ${response.status} ${text}`)
  }

  const rows = await response.json()
  return rows[0] || null
}

export async function uploadImageToSupabase(buffer, options = {}) {
  const config = getSupabaseConfig()
  if (!config) return null

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "images_document"
  const prefix = (process.env.SUPABASE_STORAGE_PREFIX || "CVC").replace(/^\/|\/$/g, "")
  const extension = options.extension || "png"
  const contentType = options.contentType || "image/png"
  const objectPath = `${prefix}/${randomUUID()}.${extension}`

  const response = await fetch(`${config.url}/storage/v1/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": contentType,
      "x-upsert": "false",
    },
    body: buffer,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Supabase upload failed: ${response.status} ${text}`)
  }

  return {
    key: `${bucket}/${objectPath}`,
    url: `${config.url}/storage/v1/object/public/${bucket}/${objectPath}`,
  }
}
