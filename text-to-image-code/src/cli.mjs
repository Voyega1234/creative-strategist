#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { loadDotEnv } from "./env.mjs"
import { runTextToImageWorkflow } from "./workflow.mjs"

loadDotEnv()

const inputPath = process.argv[2]

if (!inputPath) {
  console.error("Usage: node text-to-image-code/src/cli.mjs text-to-image-code/samples/request.json")
  process.exit(1)
}

const body = JSON.parse(await readFile(resolve(inputPath), "utf8"))
const result = await runTextToImageWorkflow(body)

console.log(JSON.stringify(result, null, 2))
