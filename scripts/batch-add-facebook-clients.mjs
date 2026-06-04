import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const API_URL = "https://www.creativecompass.io/api/competitor-research";
const CONCURRENCY = 5;
const REQUEST_TIMEOUT_MS = 7 * 60 * 1000;
const RETRY_DELAY_MS = 60 * 1000;
const RESULTS_PATH = "/private/tmp/creativecompass-batch-results.json";

const items = [
  { clientName: "Tangmo", facebookUrl: "https://www.facebook.com/suika.tangmo.th/", existingAnalysisRunId: "d340de49-f8c8-4754-9b6f-857c8f07572c", existingSavedName: "SUIKA - เสื้อแตงโม", existingProductFocus: "ขายเสื้อผ้า" },
  { clientName: "Modernform", facebookUrl: "https://www.facebook.com/modernformcompany/" },
  { clientName: "Easymoney", facebookUrl: "https://www.facebook.com/EasyMoneyTHAILAND/" },
  { clientName: "SCB 10X", facebookUrl: "https://www.facebook.com/SCB10X/" },
  { clientName: "InnovestX", facebookUrl: "https://www.facebook.com/innovestxsecurities/" },
  { clientName: "Thonglorpet", facebookUrl: "https://www.facebook.com/ThonglorPet/" },
  { clientName: "First Step", facebookUrl: "https://www.facebook.com/people/Flexx/61551063590520/" },
  { clientName: "Parin Thailand", facebookUrl: "https://www.facebook.com/parinbeautygadget" },
  { clientName: "DBP", facebookUrl: "https://www.facebook.com/DIAMONDBrandOfficial/" },
  { clientName: "Money DD", facebookUrl: "https://www.facebook.com/goodmoneybygsb?_rdc=2&_rdr#" },
  { clientName: "Villa Market", facebookUrl: "https://www.facebook.com/villamarketofficial/" },
  { clientName: "CHOW SOCIAL", facebookUrl: "https://www.facebook.com/chowsocial" },
  { clientName: "Recovery and Wellness", facebookUrl: "https://www.facebook.com/formrecovery" },
  { clientName: "Sarnies Coffee", facebookUrl: "https://www.facebook.com/sarnies.bkk/" },
  { clientName: "Swiss Lab", facebookUrl: "https://www.facebook.com/swisslabthailand1" },
  { clientName: "Dr Tan Clinic", facebookUrl: "https://www.facebook.com/doctortanclinic/" },
  { clientName: "Playboy", facebookUrl: "https://www.facebook.com/PLBYfashionthailand/" },
  { clientName: "Orbix", facebookUrl: "https://www.facebook.com/orbixinvest" },
  { clientName: "Mali Clinic", facebookUrl: "https://www.facebook.com/maliclinic.bkk/" },
  { clientName: "Aloex", facebookUrl: "https://www.facebook.com/AloExOfficial/?locale=th_TH" },
  { clientName: "Mogen", facebookUrl: "https://www.facebook.com/mogen.co.th/" },
  { clientName: "Siam Takashimaya", facebookUrl: "https://www.facebook.com/SiamTakashimayaOfficial/" },
  { clientName: "Little Shield", facebookUrl: "https://www.facebook.com/littleshield.th/" },
  { clientName: "ABB", facebookUrl: "https://www.facebook.com/ABBThailand/" },
  { clientName: "Major Mavista Phromphong", facebookUrl: "https://www.facebook.com/mjd.co.th" },
  { clientName: "Recovery me", facebookUrl: "https://www.facebook.com/recoverymeclinicofficial" },
  { clientName: "Peep Share", facebookUrl: "https://www.facebook.com/PeepShares/" },
  { clientName: "MJD Maru Chula", facebookUrl: "https://web.facebook.com/mjd.co.th?locale=th_TH" },
  { clientName: "champacawood", facebookUrl: "https://www.facebook.com/champacawoodthailand/" },
  { clientName: "pasta ama LINE", facebookUrl: "https://www.facebook.com/pastaama/" },
  { clientName: "Eritoileto", facebookUrl: "https://www.facebook.com/erihomeofficial/" },
  { clientName: "tissue chonburi tiktok consult", facebookUrl: "" },
  { clientName: "Okya", facebookUrl: "" },
  { clientName: "Vantage Markets", facebookUrl: "https://www.facebook.com/vantagemarkets.glb/" },
  { clientName: "HAAB LINE", facebookUrl: "https://www.facebook.com/haab.bkk/" },
  { clientName: "dime tiktok consult", facebookUrl: "https://www.facebook.com/dime.finance.th/" },
  { clientName: "Thermomix TH", facebookUrl: "https://www.facebook.com/ThermomixThailandTM6/" },
  { clientName: "Happy Delivery", facebookUrl: "" },
  { clientName: "SIS", facebookUrl: "https://www.facebook.com/SisDistributionThai/" },
  { clientName: "HRC SEO", facebookUrl: "https://www.facebook.com/HondaRacingTeamTH/" },
  { clientName: "The Next", facebookUrl: "https://www.facebook.com/thenextoptical/" },
  { clientName: "Zenity X", facebookUrl: "https://www.facebook.com/zenityXAiStudio/?locale=th_TH" },
  { clientName: "Reeve", facebookUrl: "https://www.facebook.com/reevebeachclubkrabi/" },
  { clientName: "Senvar", facebookUrl: "https://www.facebook.com/61579921079347/" },
  { clientName: "Babyhills TH", facebookUrl: "https://www.facebook.com/babyhillsthailand/" },
  { clientName: "Angel's Secret", facebookUrl: "https://www.facebook.com/THAngelsecret/" },
  { clientName: "It’S SKIN", facebookUrl: "https://www.facebook.com/itsskinthailand/" },
  { clientName: "Smilebloom", facebookUrl: "https://www.facebook.com/smilebloomth/?locale=th_TH" },
  { clientName: "Mami", facebookUrl: "https://www.facebook.com/mamicosofficial/" },
  { clientName: "Thaisyncon", facebookUrl: "https://www.facebook.com/THAISYNCON/" },
  { clientName: "Nara Stainless", facebookUrl: "https://www.facebook.com/NARAStainless.Thailand/" },
  { clientName: "B Autohaus", facebookUrl: "https://www.facebook.com/BAUTOHAUS/" },
  { clientName: "Elitile", facebookUrl: "https://www.facebook.com/100088830496582/" },
  { clientName: "Jno Thailand", facebookUrl: "https://www.facebook.com/p/Jno-Thailand-61579847742032/" },
  { clientName: "Siammittraphap", facebookUrl: "https://www.facebook.com/SMCooling/" },
  { clientName: "Provamed", facebookUrl: "https://www.facebook.com/Provamedclub/" },
  { clientName: "TRUE Business Tiktok", facebookUrl: "https://www.facebook.com/trueforbusiness/" },
  { clientName: "Siam Takashimaya 2", facebookUrl: "https://www.facebook.com/SiamTakashimayaOfficial/" },
  { clientName: "AT U DENTAL", facebookUrl: "https://www.facebook.com/ATUDentalClinic/" },
  { clientName: "Alena D", facebookUrl: "https://www.facebook.com/AlenaDevelopment/" },
  { clientName: "Meko Skin Care", facebookUrl: "https://www.facebook.com/mekoskincare/" },
  { clientName: "Thunder solution", facebookUrl: "https://www.facebook.com/thunderslip/" },
  { clientName: "Siam Pearl Property", facebookUrl: "https://www.facebook.com/p/Siampearl-Property-61552606621220/" },
  { clientName: "Muniq charoenkrung", facebookUrl: "https://www.facebook.com/mjd.co.th/" },
  { clientName: "Buildman", facebookUrl: "https://www.facebook.com/buildman.biz/" },
  { clientName: "MCA ASSET", facebookUrl: "https://www.facebook.com/p/MCA-ASSET-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99%E0%B8%A3%E0%B8%B5%E0%B9%82%E0%B8%99%E0%B9%80%E0%B8%A7%E0%B8%97%E0%B8%9E%E0%B8%A3%E0%B9%89%E0%B8%AD%E0%B8%A1%E0%B8%AD%E0%B8%A2%E0%B8%B9%E0%B9%88%E0%B8%AA%E0%B8%A1%E0%B8%B8%E0%B8%97%E0%B8%A3%E0%B8%AA%E0%B8%B2%E0%B8%84%E0%B8%A3-100071869384082/" },
  { clientName: "Movefast JSP", facebookUrl: "https://www.facebook.com/movefast.me/" },
  { clientName: "Movefast Aelova", facebookUrl: "https://www.facebook.com/movefast.me/" },
  { clientName: "MLAB", facebookUrl: "https://www.facebook.com/p/MLAB-61563946061076/" },
  { clientName: "Tabienpharuay", facebookUrl: "https://www.facebook.com/61583468676602/" },
  { clientName: "TCL 2026", facebookUrl: "https://www.facebook.com/TCLThailand/" },
  { clientName: "Thaya", facebookUrl: "https://www.facebook.com/Thayahotel/" },
  { clientName: "Nura Thailand", facebookUrl: "https://www.facebook.com/nurasoundthailand/" },
  { clientName: "Movefast Pamu", facebookUrl: "https://www.facebook.com/movefast.me/" },
  { clientName: "Dortmuend", facebookUrl: "https://www.facebook.com/dortmuend/" },
  { clientName: "ALTERNATE TAB ADVERTISING", facebookUrl: "https://www.facebook.com/alttabadvertising/" },
  { clientName: "Luciaka", facebookUrl: "https://www.facebook.com/61552968118724/" },
  { clientName: "Starmark Work Space", facebookUrl: "https://www.facebook.com/starmarkworksspace/" },
  { clientName: "Dermatiks", facebookUrl: "https://www.facebook.com/Dermatiks/" },
  { clientName: "STARMARK kitchen", facebookUrl: "https://www.facebook.com/starmarkkitchen/" },
  { clientName: "Sewa", facebookUrl: "https://www.facebook.com/sewathailand/" },
];

function loadEnv() {
  const envPath = path.resolve(".env");
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function renameSavedRows(supabase, item, result) {
  const analysisRunId = item.existingAnalysisRunId || result.analysisRunId;
  const oldName = item.existingSavedName || result.clientName;
  const productFocus = item.existingProductFocus || result.productFocus;
  if (!analysisRunId || !oldName || !productFocus) {
    throw new Error("Missing analysisRunId, oldName, or productFocus for rename");
  }

  const clientUpdate = await supabase
    .from("Clients")
    .update({ clientName: item.clientName })
    .eq("id", analysisRunId);
  if (clientUpdate.error) throw new Error(`Clients rename failed: ${clientUpdate.error.message}`);

  const competitorUpdate = await supabase
    .from("Competitor")
    .update({ name: item.clientName })
    .eq("analysisRunId", analysisRunId)
    .eq("name", oldName);
  if (competitorUpdate.error) throw new Error(`Competitor rename failed: ${competitorUpdate.error.message}`);

  const researchUpdate = await supabase
    .from("research_market")
    .update({ client_name: item.clientName })
    .eq("client_name", oldName)
    .eq("product_focus", productFocus);
  if (researchUpdate.error) throw new Error(`research_market rename failed: ${researchUpdate.error.message}`);

  return { analysisRunId, oldName, productFocus };
}

async function processItem(supabase, item, attempt) {
  if (!item.facebookUrl) {
    return { clientName: item.clientName, status: "skipped", reason: "missing facebookUrl" };
  }

  if (item.existingAnalysisRunId) {
    const rename = await renameSavedRows(supabase, item, {});
    return { clientName: item.clientName, status: "renamed-existing", ...rename };
  }

  const payload = {
    clientName: item.clientName,
    websiteUrl: "",
    facebookUrl: item.facebookUrl,
    market: "Thailand",
    productFocus: "General",
    additionalInfo: "",
    userCompetitors: "",
    ad_account_id: null,
  };

  const startedAt = Date.now();
  const response = await fetchWithTimeout(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response ${response.status}: ${text.slice(0, 300)}`);
  }

  if (!response.ok || !result.success) {
    throw new Error(`API failed ${response.status}: ${result.error || text.slice(0, 300)}`);
  }

  const rename = await renameSavedRows(supabase, item, result);
  return {
    clientName: item.clientName,
    status: "success",
    attempt,
    elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
    apiClientName: result.clientName,
    strategicInsightsGenerated: result.strategicInsightsGenerated,
    competitors: Array.isArray(result.competitors) ? result.competitors.length : 0,
    ...rename,
  };
}

async function runBatch(supabase, batchItems, attempt) {
  const results = [];
  let index = 0;

  async function worker(workerIndex) {
    while (index < batchItems.length) {
      const currentIndex = index++;
      const item = batchItems[currentIndex];
      const label = `${currentIndex + 1}/${batchItems.length} ${item.clientName}`;
      console.log(`[attempt ${attempt}][worker ${workerIndex}] start ${label}`);
      try {
        const result = await processItem(supabase, item, attempt);
        console.log(`[attempt ${attempt}][worker ${workerIndex}] ${result.status} ${label}`);
        results.push(result);
      } catch (error) {
        console.log(`[attempt ${attempt}][worker ${workerIndex}] error ${label}: ${error.message}`);
        results.push({
          clientName: item.clientName,
          facebookUrl: item.facebookUrl,
          status: "error",
          attempt,
          error: error.message,
        });
      }
      fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));
  return results;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const supabase = createClient(url, anon);
const validItems = items.filter((item) => item.facebookUrl || item.existingAnalysisRunId);
const skippedItems = items
  .filter((item) => !item.facebookUrl && !item.existingAnalysisRunId)
  .map((item) => ({ clientName: item.clientName, status: "skipped", reason: "missing facebookUrl" }));

console.log(`Starting batch. valid=${validItems.length}, skipped=${skippedItems.length}, concurrency=${CONCURRENCY}`);
let allResults = [...skippedItems, ...(await runBatch(supabase, validItems, 1))];

let retryItems = validItems.filter((item) =>
  allResults.some((result) => result.clientName === item.clientName && result.status === "error")
);

if (retryItems.length > 0) {
  console.log(`Waiting ${RETRY_DELAY_MS / 1000}s before retrying ${retryItems.length} failed item(s).`);
  await sleep(RETRY_DELAY_MS);
  const retryResults = await runBatch(supabase, retryItems, 2);
  allResults = allResults
    .filter((result) => !(result.status === "error" && retryItems.some((item) => item.clientName === result.clientName)))
    .concat(retryResults);
}

fs.writeFileSync(RESULTS_PATH, JSON.stringify(allResults, null, 2));
const summary = allResults.reduce((acc, result) => {
  acc[result.status] = (acc[result.status] || 0) + 1;
  return acc;
}, {});
console.log("Final summary:", summary);
console.log(`Results written to ${RESULTS_PATH}`);
