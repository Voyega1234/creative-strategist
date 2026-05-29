#!/usr/bin/env node
import { createServer } from "node:http"
import { loadDotEnv } from "./env.mjs"
import { runTextToImageWorkflow } from "./workflow.mjs"

loadDotEnv()

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
      if (body.length > 10_000_000) {
        reject(new Error("Request body too large"))
        req.destroy()
      }
    })
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on("error", reject)
  })
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(payload, null, 2))
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === "GET" && req.url === "/generate-image") {
    return sendJson(res, 200, {
      ok: true,
      message: "Use POST /generate-image with a JSON body to run the image workflow.",
      example: {
        client: "Example Brand",
        prompt: "Create a promotional ad image for a new product launch.",
        userBrief: "Clean, modern, readable, youth-oriented.",
        reference_image_urls: [],
        material_image_urls: [],
        aspect_ratio: "4:5",
        color_palette: ["#111111", "#ffffff"],
      },
    })
  }

  if (req.method !== "POST" || req.url !== "/generate-image") {
    return sendJson(res, 404, { error: "Not found" })
  }

  try {
    const body = await readJson(req)
    const result = await runTextToImageWorkflow(body)
    sendJson(res, 200, result)
  } catch (error) {
    sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

const port = Number(process.env.PORT || 8787)
const host = process.env.HOST || "127.0.0.1"
server.listen(port, host, () => {
  console.log(`Text-to-image code server listening on http://${host}:${port}`)
})
