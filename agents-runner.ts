// Multi-agent SEO system runner
// Starts all 7 Telegram bots as concurrent polling processes

import { startConductor } from "./agents/conductor.ts";
import { startCopywriter } from "./agents/copywriter.ts";
import { startSearcher } from "./agents/searcher.ts";
import { startAnalyst } from "./agents/analyst.ts";
import { startSeoOptimizer } from "./agents/seo-optimizer.ts";
import { startDistribution } from "./agents/distribution.ts";
import { startGscAgent } from "./agents/gsc-agent.ts";

console.log("🤖 Starting SEO multi-agent system...");
console.log("Required env vars:");
const required = [
  "ANTHROPIC_API_KEY",
  "CONDUCTOR_TOKEN",
  "COPYWRITER_TOKEN",
  "SEARCHER_TOKEN",
  "ANALYST_TOKEN",
  "SEO_OPTIMIZER_TOKEN",
  "DISTRIBUTION_TOKEN",
  "GSC_AGENT_TOKEN",
  "SEO_GROUP_ID",
  "BOT_TOKEN",
];

for (const v of required) {
  const set = !!process.env[v];
  console.log(`  ${set ? "✅" : "❌"} ${v}`);
}

await Promise.all([
  startConductor(),
  startCopywriter(),
  startSearcher(),
  startAnalyst(),
  startSeoOptimizer(),
  startDistribution(),
  startGscAgent(),
]);
