import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const OPENBRAND_ENDPOINT = "https://openbrand.sh/api/extract";
const CONCURRENCY = 5;
const TIMEOUT_MS = 30_000;
const RESULTS_PATH = "/private/tmp/seo-blog-banner-backfill-results.json";

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

function loadWebsiteMap() {
  const source = fs.readFileSync("lib/seo-blog-banner/client-websites.ts", "utf8");
  const match = source.match(/SEO_BLOG_BANNER_CLIENT_WEBSITES:\s*Record<string,\s*string>\s*=\s*({[\s\S]*?})\s*\n\nexport function/);
  if (!match) throw new Error("Could not parse website map");
  return Function(`"use strict"; return (${match[1]});`)();
}

function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label}`)), TIMEOUT_MS)),
  ]);
}

function isLikelyFaviconLogo(logo) {
  const url = logo.url || "";
  const width = logo.resolution?.width || 0;
  const height = logo.resolution?.height || 0;
  return /favicon|apple-touch-icon|cropped-favicon/i.test(`${logo.type || ""} ${url}`) || (width > 0 && height > 0 && width <= 180 && height <= 180);
}

function isRasterImageUrl(url) {
  return /\.(png|jpe?g|webp)(?:\?|#|$)/i.test(url);
}

function selectOpenBrandLogo(logos) {
  const withUrl = logos.filter((logo) => typeof logo.url === "string" && logo.url.trim());
  const nonFavicon = withUrl.filter((logo) => !isLikelyFaviconLogo(logo));
  const raster = withUrl
    .filter((logo) => isRasterImageUrl(logo.url || ""))
    .sort((a, b) => ((b.resolution?.width || 0) * (b.resolution?.height || 0)) - ((a.resolution?.width || 0) * (a.resolution?.height || 0)));
  const nonFaviconRaster = nonFavicon.find((logo) => isRasterImageUrl(logo.url || ""));
  const likelyLogo = nonFavicon.find((logo) => /logo|brandmark|wordmark/i.test(`${logo.type || ""} ${logo.url || ""}`));
  return nonFaviconRaster?.url || likelyLogo?.url || raster[0]?.url || nonFavicon[0]?.url || withUrl[0]?.url || "";
}

async function fetchOpenBrand(website, apiKey) {
  const response = await withTimeout(
    fetch(`${OPENBRAND_ENDPOINT}?url=${encodeURIComponent(website)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
    `OpenBrand ${website}`,
  );
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `OpenBrand failed ${response.status}`);
  }
  const data = payload.data || {};
  const colors = Array.isArray(data.colors) ? data.colors.map((color) => color.hex).filter(Boolean) : [];
  const logos = Array.isArray(data.logos) ? data.logos : [];
  return {
    colors,
    logo: selectOpenBrandLogo(logos),
  };
}

async function processClient(supabase, apiKey, client) {
  const website = client.website;
  await supabase
    .from("Clients")
    .update({ clientWebsiteUrl: website, updatedAt: new Date().toISOString() })
    .eq("id", client.id)
    .throwOnError();

  const assets = await fetchOpenBrand(website, apiKey);
  await supabase
    .from("Clients")
    .update({
      clientWebsiteUrl: website,
      color_palette: assets.colors,
      logo_page: assets.logo || null,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", client.id)
    .throwOnError();

  return { ...client, status: "success", colors: assets.colors.length, hasLogo: Boolean(assets.logo) };
}

async function runBatch(items, worker) {
  const results = [];
  let index = 0;
  async function loop(workerIndex) {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      console.log(`[worker ${workerIndex}] start ${currentIndex + 1}/${items.length} ${item.clientName}`);
      try {
        const result = await worker(item);
        console.log(`[worker ${workerIndex}] ${result.status} ${item.clientName}`);
        results.push(result);
      } catch (error) {
        console.log(`[worker ${workerIndex}] error ${item.clientName}: ${error.message}`);
        results.push({ ...item, status: "error", error: error.message });
      }
      fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => loop(i + 1)));
  return results;
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const websiteMap = loadWebsiteMap();

const { data: clients, error } = await supabase
  .from("Clients")
  .select("id, clientName, productFocus, clientWebsiteUrl");
if (error) throw error;

const rows = [];
for (const client of clients || []) {
  const website = websiteMap[client.clientName];
  if (!website) continue;
  rows.push({ ...client, website });
}

console.log(`Backfilling ${rows.length} client row(s), concurrency=${CONCURRENCY}`);
const results = await runBatch(rows, (client) => processClient(supabase, env.OPENBRAND_API, client));
const summary = results.reduce((acc, result) => {
  acc[result.status] = (acc[result.status] || 0) + 1;
  return acc;
}, {});
console.log("Final summary:", summary);
console.log(`Results written to ${RESULTS_PATH}`);
