import "server-only"

import { ExternalAccountClient, GoogleAuth } from "google-auth-library"
import { getVercelOidcToken } from "@vercel/oidc"

/**
 * Central Vertex AI access for all Gemini calls.
 *
 * Auth is credential-free in code:
 * - Local dev: Application Default Credentials (run `gcloud auth application-default login`).
 * - Vercel: Workload Identity Federation — the Vercel OIDC token is exchanged for a
 *   short-lived Google access token via a workload identity provider + service account.
 *   See https://vercel.com/docs/oidc/gcp
 *
 * No API keys. Replaces the previous NEXT_PUBLIC_GEMINI_API_KEY + generativelanguage endpoint.
 */

const SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]
const LOCATION = process.env.VERTEX_LOCATION || "global"
const PROJECT_ID = process.env.GCP_PROJECT_ID || ""

let cachedTokenProvider: (() => Promise<string>) | null = null

function buildTokenProvider(): () => Promise<string> {
  const projectNumber = process.env.GCP_PROJECT_NUMBER
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID

  // Vercel: exchange the Vercel OIDC token for a Google access token via Workload
  // Identity Federation. Shape follows https://vercel.com/docs/oidc/gcp exactly.
  // Gated on process.env.VERCEL so local dev uses ADC even though the GCP_* vars
  // are also present in .env (getVercelOidcToken only works on Vercel).
  if (process.env.VERCEL && projectNumber && serviceAccountEmail && poolId && providerId) {
    const client = ExternalAccountClient.fromJSON({
      type: "external_account",
      audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`,
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      token_url: "https://sts.googleapis.com/v1/token",
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
      subject_token_supplier: {
        // Use the Vercel OIDC token as the subject token.
        getSubjectToken: () => getVercelOidcToken(),
      },
    })

    if (!client) {
      throw new Error("Failed to initialize Workload Identity client from GCP_* environment variables")
    }
    client.scopes = SCOPES

    return async () => {
      const token = await client.getAccessToken()
      if (!token.token) throw new Error("Workload Identity Federation returned no access token")
      return token.token
    }
  }

  // Local / ADC. Picks up `gcloud auth application-default login` or GOOGLE_APPLICATION_CREDENTIALS.
  const auth = new GoogleAuth({ scopes: SCOPES })
  return async () => {
    const token = await auth.getAccessToken()
    if (!token) {
      throw new Error(
        "No Application Default Credentials found. Run `gcloud auth application-default login` for local development.",
      )
    }
    return token
  }
}

async function getAccessToken(): Promise<string> {
  if (!cachedTokenProvider) {
    cachedTokenProvider = buildTokenProvider()
  }
  return cachedTokenProvider()
}

function getVertexHost(): string {
  return LOCATION === "global" ? "aiplatform.googleapis.com" : `${LOCATION}-aiplatform.googleapis.com`
}

// Vertex AI requires every `contents` entry to carry a role ("user" | "model"),
// while the Gemini Developer API allowed omitting it. Default missing roles to "user"
// so existing single-turn payloads pass through unchanged; explicit roles are preserved.
function withContentRoles(body: unknown): unknown {
  if (!body || typeof body !== "object" || !("contents" in body)) return body
  const { contents } = body as { contents?: unknown }
  if (!Array.isArray(contents)) return body

  return {
    ...body,
    contents: contents.map((entry) =>
      entry && typeof entry === "object" && !("role" in entry) ? { role: "user", ...entry } : entry,
    ),
  }
}

function withLabels(body: unknown, labels?: Record<string, string>): unknown {
  if (!labels || Object.keys(labels).length === 0 || !body || typeof body !== "object" || Array.isArray(body)) {
    return body
  }

  const existingLabels =
    "labels" in body && body.labels && typeof body.labels === "object" && !Array.isArray(body.labels)
      ? (body.labels as Record<string, string>)
      : {}

  return {
    ...body,
    labels: {
      ...existingLabels,
      ...labels,
    },
  }
}

/**
 * POST to the Vertex AI `generateContent` endpoint for a Gemini model.
 * Returns the raw fetch Response so callers parse it exactly as before.
 *
 * The request body is the same shape used by the Gemini API (contents, generationConfig,
 * systemInstruction, tools), so existing payloads pass through unchanged — except grounding,
 * which on Vertex uses `googleSearch` instead of `google_search`.
 */
export async function vertexGenerateContent(
  model: string,
  body: unknown,
  init?: { signal?: AbortSignal; labels?: Record<string, string> },
): Promise<Response> {
  if (!PROJECT_ID) {
    throw new Error("GCP_PROJECT_ID is not configured")
  }

  const token = await getAccessToken()
  const url = `https://${getVertexHost()}/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${model}:generateContent`

  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withLabels(withContentRoles(body), init?.labels)),
    signal: init?.signal,
  })
}
