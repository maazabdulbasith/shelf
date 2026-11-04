#!/usr/bin/env node
/**
 * Security gate for Shelf Ask/Agent guardrails.
 * Fails the process (exit 1) if any case regresses.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const guardrailsPath = join(root, "apps", "web", "app", "lib", "guardrails.mjs");
const casesPath = join(__dirname, "security_cases.json");

const {
  evaluateAskGuardrails,
  isAgentInjectionGoal,
} = await import(pathToFileURL(guardrailsPath).href);

const spec = JSON.parse(readFileSync(casesPath, "utf8"));
const failures = [];

for (const c of spec.cases) {
  const gate = evaluateAskGuardrails(c.question);
  if (gate.action !== c.expect_action) {
    failures.push(`${c.id}: action=${gate.action} expected=${c.expect_action}`);
  }
  if (c.expect_reason && gate.reason !== c.expect_reason) {
    failures.push(`${c.id}: reason=${gate.reason} expected=${c.expect_reason}`);
  }
  const blob = `${gate.answer || ""}`;
  for (const bad of c.must_not_contain || []) {
    if (bad && blob.toLowerCase().includes(String(bad).toLowerCase())) {
      failures.push(`${c.id}: leaked forbidden token "${bad}" in answer`);
    }
  }
}

for (const c of spec.agent_cases || []) {
  const refused = isAgentInjectionGoal(c.goal);
  if (Boolean(refused) !== Boolean(c.expect_refuse)) {
    failures.push(
      `${c.id}: agent_refuse=${refused} expected=${c.expect_refuse}`
    );
  }
}

if (failures.length) {
  console.error("SECURITY EVAL FAILED");
  for (const line of failures) console.error(" -", line);
  process.exit(1);
}

console.log(
  `SECURITY EVAL PASSED (${spec.cases.length} ask + ${(spec.agent_cases || []).length} agent cases)`
);
