import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  getAllPolicies,
  getPolicy,
  searchPolicies,
  upsertPolicy,
  deletePolicy,
  type Policy,
} from "./data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, "..", "assets");

async function readWidgetHtml(filename: string): Promise<string> {
  return fs.readFile(path.join(ASSETS_DIR, filename), "utf-8");
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

// ── Gap analysis logic ───────────────────────────────────────────────────────
interface GapItem {
  category: string;
  area: string;
  severity: "critical" | "warning" | "info";
  currentCoverage: string;
  recommendedCoverage: string;
  riskScenario: string;
}

function analyzeGaps(policies: Policy[]): { gaps: GapItem[]; score: number; breakdown: Record<string, number> } {
  const gaps: GapItem[] = [];
  const breakdown: Record<string, number> = {};

  const homePolicy = policies.find((p) => p.type === "homeowners");
  const autoPolicy = policies.find((p) => p.type === "auto");
  const lifePolicy = policies.find((p) => p.type === "life");
  const umbrellaPolicy = policies.find((p) => p.type === "umbrella");

  if (homePolicy) {
    const dwelling = homePolicy.coverages.find((c) => c.type === "Dwelling");
    if (dwelling && dwelling.limit < 400000) {
      gaps.push({
        category: "Property", area: "Dwelling Coverage", severity: "warning",
        currentCoverage: fmt(dwelling.limit), recommendedCoverage: fmt(400000),
        riskScenario: "If your home is destroyed, you may not have enough to rebuild at today's construction costs.",
      });
    }
    const liability = homePolicy.coverages.find((c) => c.type === "Personal Liability");
    if (liability && liability.limit < 300000) {
      gaps.push({
        category: "Liability", area: "Home Liability", severity: "critical",
        currentCoverage: fmt(liability.limit), recommendedCoverage: fmt(300000),
        riskScenario: "If someone is injured on your property and sues, $100K may not cover medical bills and legal fees.",
      });
    }
    if (homePolicy.exclusions.includes("Flood damage")) {
      gaps.push({
        category: "Property", area: "Flood Coverage", severity: "warning",
        currentCoverage: "Not covered", recommendedCoverage: "Separate flood policy",
        riskScenario: "Standard homeowner's policies exclude flood. Even a few inches of water can cause $50K+ in damage.",
      });
    }
    if (homePolicy.exclusions.includes("Sewer backup")) {
      gaps.push({
        category: "Property", area: "Sewer Backup", severity: "info",
        currentCoverage: "Not covered", recommendedCoverage: "Endorsement ($5K–$25K)",
        riskScenario: "Sewer backups cause an average of $10K in damage and are increasingly common.",
      });
    }
    const homeLiab = homePolicy.coverages.find((c) => c.type === "Personal Liability");
    breakdown["Home"] = homeLiab && homeLiab.limit >= 300000 ? 85 : 60;
  } else {
    gaps.push({
      category: "Property", area: "Homeowner's Insurance", severity: "critical",
      currentCoverage: "None", recommendedCoverage: "Full homeowner's policy",
      riskScenario: "Without homeowner's insurance, your largest asset is completely unprotected.",
    });
    breakdown["Home"] = 0;
  }

  if (autoPolicy) {
    const bodilyInjury = autoPolicy.coverages.find((c) => c.type === "Bodily Injury Liability");
    if (bodilyInjury && bodilyInjury.limit < 100000) {
      gaps.push({
        category: "Liability", area: "Auto Bodily Injury", severity: "critical",
        currentCoverage: fmt(bodilyInjury.limit), recommendedCoverage: fmt(100000) + "/" + fmt(300000),
        riskScenario: "A serious accident could result in medical bills far exceeding $50K. You'd be personally liable for the difference.",
      });
    }
    const collision = autoPolicy.coverages.find((c) => c.type === "Collision");
    if (!collision) {
      gaps.push({
        category: "Vehicle", area: "Collision Coverage", severity: "warning",
        currentCoverage: "Not covered", recommendedCoverage: "$500 deductible",
        riskScenario: "If you cause an accident, you'll pay out-of-pocket to repair or replace your vehicle.",
      });
    }
    const comprehensive = autoPolicy.coverages.find((c) => c.type === "Comprehensive");
    if (!comprehensive) {
      gaps.push({
        category: "Vehicle", area: "Comprehensive Coverage", severity: "warning",
        currentCoverage: "Not covered", recommendedCoverage: "$250 deductible",
        riskScenario: "Theft, hail, vandalism, or hitting a deer — none of these would be covered.",
      });
    }
    breakdown["Auto"] = collision && comprehensive ? 90 : bodilyInjury && bodilyInjury.limit >= 100000 ? 65 : 40;
  } else {
    breakdown["Auto"] = 0;
  }

  if (lifePolicy) {
    const deathBenefit = lifePolicy.coverages.find((c) => c.type.includes("Death Benefit"));
    if (deathBenefit && deathBenefit.limit < 500000) {
      gaps.push({
        category: "Life", area: "Death Benefit", severity: "info",
        currentCoverage: fmt(deathBenefit.limit), recommendedCoverage: fmt(500000),
        riskScenario: "Financial planners recommend 10-12x annual income. Consider if current coverage meets your family's needs.",
      });
    }
    breakdown["Life"] = deathBenefit && deathBenefit.limit >= 500000 ? 90 : 70;
  } else {
    gaps.push({
      category: "Life", area: "Life Insurance", severity: "warning",
      currentCoverage: "None", recommendedCoverage: "Term life (10-12x income)",
      riskScenario: "Without life insurance, your dependents may face financial hardship if something happens to you.",
    });
    breakdown["Life"] = 0;
  }

  if (!umbrellaPolicy) {
    gaps.push({
      category: "Liability", area: "Umbrella Coverage", severity: "warning",
      currentCoverage: "None", recommendedCoverage: "$1M umbrella policy",
      riskScenario: "A major lawsuit could exceed your home and auto liability limits. An umbrella policy costs ~$300-$500/year for $1M.",
    });
    breakdown["Umbrella"] = 0;
  } else {
    breakdown["Umbrella"] = 95;
  }

  const values = Object.values(breakdown);
  const score = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
  return { gaps, score, breakdown };
}

// ── Quote estimation ─────────────────────────────────────────────────────────
function estimateQuote(changeType: string, currentPremium: number, _details: Record<string, unknown>) {
  let multiplier = 1.0;
  let explanation = "";
  switch (changeType) {
    case "increase-liability":
      multiplier = 1.15;
      explanation = "Increasing liability limit typically adds 10-20% to your premium.";
      break;
    case "add-collision":
      multiplier = 1.35;
      explanation = "Adding collision coverage typically increases premium by 30-40%.";
      break;
    case "add-comprehensive":
      multiplier = 1.20;
      explanation = "Adding comprehensive coverage typically increases premium by 15-25%.";
      break;
    case "lower-deductible":
      multiplier = 1.12;
      explanation = "Lowering your deductible increases premium by approximately 10-15%.";
      break;
    case "add-umbrella":
      return { estimatedPremium: currentPremium + 42, difference: 42, explanation: "An umbrella policy typically costs $300-$500/year ($25-$42/month) for $1M in coverage." };
    case "add-flood":
      return { estimatedPremium: currentPremium + 75, difference: 75, explanation: "Flood insurance through NFIP averages $700-$1,000/year ($60-$85/month) depending on flood zone." };
    default:
      multiplier = 1.10;
      explanation = "Estimated 10% premium adjustment for the requested change.";
  }
  const estimatedPremium = Math.round(currentPremium * multiplier);
  return { estimatedPremium, difference: estimatedPremium - currentPremium, explanation };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Zod schemas for tool parameters
// ═══════════════════════════════════════════════════════════════════════════════

const PolicyIdsSchema = {
  policyIds: z.array(z.string()).describe("Array of policy IDs"),
};

const PolicyIdsOptionalSchema = {
  policyIds: z.array(z.string()).optional().describe("Policy IDs to analyze. If empty, analyzes all."),
};

const ComparisonInputSchema = {
  policyIds: z.array(z.string()).min(2).max(4).describe("Array of 2-4 policy IDs to compare"),
  filterCategory: z
    .enum(["property", "liability", "vehicle", "life", "medical", "extras"])
    .optional()
    .describe("Optional category filter"),
};

const PolicyIdSchema = {
  policyId: z.string().describe("The policy ID"),
};

const SearchSchema = {
  type: z.string().optional().describe("Policy type: homeowners, auto, life, umbrella"),
  carrier: z.string().optional().describe("Carrier name filter (partial match)"),
  minCoverage: z.number().optional().describe("Minimum coverage amount filter"),
};

const QuoteSchema = {
  policyId: z.string().describe("The policy ID to estimate changes for"),
  changeType: z
    .enum(["increase-liability", "add-collision", "add-comprehensive", "lower-deductible", "add-umbrella", "add-flood"])
    .describe("Type of coverage change"),
};

// ═══════════════════════════════════════════════════════════════════════════════
// Server factory
// ═══════════════════════════════════════════════════════════════════════════════

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Policy Compare MCP Server",
    version: "1.0.0",
  });

  const comparisonUri = "ui://show-policy-comparison/mcp-app.html";
  const gapAnalysisUri = "ui://show-gap-analysis/mcp-app.html";
  const policyDetailUri = "ui://show-policy-detail/mcp-app.html";
  const recommendationUri = "ui://show-recommendation/mcp-app.html";

  // ══════════════════════════════════════════════════════════════════════════════
  // RICH UI TOOLS
  // ══════════════════════════════════════════════════════════════════════════════

  // 1. show-policy-comparison
  registerAppTool(
    server,
    "show-policy-comparison",
    {
      title: "Compare Policies",
      description: "Show an interactive side-by-side comparison matrix of 2-4 insurance policies with color-coded cells.",
      inputSchema: ComparisonInputSchema,
      _meta: { ui: { resourceUri: comparisonUri } },
    },
    async ({ policyIds, filterCategory }: { policyIds: string[]; filterCategory?: string }): Promise<CallToolResult> => {
      const policies = (await Promise.all(policyIds.map((id) => getPolicy(id)))).filter(Boolean) as Policy[];
      if (policies.length < 2) {
        return { content: [{ type: "text", text: "Need at least 2 valid policies to compare." }] };
      }
      const summary = policies.map((p) => `${p.carrier} ${p.type} (${p.policyNumber}): ${fmt(p.premiumMonthly)}/mo`).join(" | ");
      return {
        content: [{ type: "text", text: `Comparing ${policies.length} policies: ${summary}` }],
        structuredContent: { policies, filterCategory: filterCategory ?? null },
      };
    },
  );

  // 2. show-gap-analysis
  registerAppTool(
    server,
    "show-gap-analysis",
    {
      title: "Coverage Gap Analysis",
      description: "Show a visual gap analysis highlighting under-coverage, overlapping coverage, with risk scenarios.",
      inputSchema: PolicyIdsOptionalSchema,
      _meta: { ui: { resourceUri: gapAnalysisUri } },
    },
    async ({ policyIds }: { policyIds?: string[] }): Promise<CallToolResult> => {
      let policies: Policy[];
      if (policyIds && policyIds.length > 0) {
        policies = (await Promise.all(policyIds.map((id) => getPolicy(id)))).filter(Boolean) as Policy[];
      } else {
        policies = await getAllPolicies();
      }
      const { gaps, score, breakdown } = analyzeGaps(policies);
      const criticalCount = gaps.filter((g) => g.severity === "critical").length;
      const warningCount = gaps.filter((g) => g.severity === "warning").length;
      return {
        content: [{ type: "text", text: `Coverage Score: ${score}/100. Found ${gaps.length} gaps (${criticalCount} critical, ${warningCount} warnings).` }],
        structuredContent: { gaps, score, breakdown, policies: policies.map((p) => ({ id: p.id, carrier: p.carrier, type: p.type })) },
      };
    },
  );

  // 3. show-policy-detail
  registerAppTool(
    server,
    "show-policy-detail",
    {
      title: "Policy Details",
      description: "Show a detailed entity card for a single insurance policy.",
      inputSchema: PolicyIdSchema,
      _meta: { ui: { resourceUri: policyDetailUri } },
    },
    async ({ policyId }: { policyId: string }): Promise<CallToolResult> => {
      const policy = await getPolicy(policyId);
      if (!policy) return { content: [{ type: "text", text: `Policy ${policyId} not found.` }] };
      const totalCoverage = policy.coverages.reduce((sum, c) => sum + c.limit, 0);
      return {
        content: [{ type: "text", text: `${policy.carrier} ${policy.type} (${policy.policyNumber}). Premium: ${fmt(policy.premiumMonthly)}/mo. Total: ${fmt(totalCoverage)}.` }],
        structuredContent: { policy },
      };
    },
  );

  // 4. show-recommendation
  registerAppTool(
    server,
    "show-recommendation",
    {
      title: "Coverage Recommendations",
      description: "Show recommended actions to improve coverage with estimated cost impact.",
      inputSchema: PolicyIdsOptionalSchema,
      _meta: { ui: { resourceUri: recommendationUri } },
    },
    async ({ policyIds }: { policyIds?: string[] }): Promise<CallToolResult> => {
      let policies: Policy[];
      if (policyIds && policyIds.length > 0) {
        policies = (await Promise.all(policyIds.map((id) => getPolicy(id)))).filter(Boolean) as Policy[];
      } else {
        policies = await getAllPolicies();
      }
      const { gaps } = analyzeGaps(policies);

      interface Rec { title: string; description: string; priority: "high" | "medium" | "low"; estimatedMonthlyCost: number; relatedGap: string; actionType: string; }
      const recommendations: Rec[] = [];

      for (const gap of gaps) {
        if (gap.severity === "critical" && gap.area === "Auto Bodily Injury") {
          const auto = policies.find((p) => p.type === "auto");
          const est = estimateQuote("increase-liability", auto?.premiumMonthly ?? 100, {});
          recommendations.push({ title: "Increase Auto Liability to 100/300", description: `Current: ${gap.currentCoverage}. ${est.explanation}`, priority: "high", estimatedMonthlyCost: est.difference, relatedGap: gap.area, actionType: "increase-liability" });
        }
        if (gap.severity === "critical" && gap.area === "Home Liability") {
          const home = policies.find((p) => p.type === "homeowners");
          const est = estimateQuote("increase-liability", home?.premiumMonthly ?? 150, {});
          recommendations.push({ title: "Increase Home Liability to $300K", description: `Current: ${gap.currentCoverage}. ${est.explanation}`, priority: "high", estimatedMonthlyCost: est.difference, relatedGap: gap.area, actionType: "increase-liability" });
        }
        if (gap.area === "Collision Coverage") {
          const auto = policies.find((p) => p.type === "auto");
          const est = estimateQuote("add-collision", auto?.premiumMonthly ?? 100, {});
          recommendations.push({ title: "Add Collision Coverage", description: `Protect your vehicle. ${est.explanation}`, priority: "medium", estimatedMonthlyCost: est.difference, relatedGap: gap.area, actionType: "add-collision" });
        }
        if (gap.area === "Comprehensive Coverage") {
          const auto = policies.find((p) => p.type === "auto");
          const est = estimateQuote("add-comprehensive", auto?.premiumMonthly ?? 100, {});
          recommendations.push({ title: "Add Comprehensive Coverage", description: `Cover theft and weather damage. ${est.explanation}`, priority: "medium", estimatedMonthlyCost: est.difference, relatedGap: gap.area, actionType: "add-comprehensive" });
        }
        if (gap.area === "Umbrella Coverage") {
          recommendations.push({ title: "Add $1M Umbrella Policy", description: "Extends liability beyond home and auto limits. ~$25-$42/month.", priority: "high", estimatedMonthlyCost: 35, relatedGap: gap.area, actionType: "add-umbrella" });
        }
        if (gap.area === "Flood Coverage") {
          recommendations.push({ title: "Consider Flood Insurance", description: "NFIP policies average $60-$85/month depending on zone.", priority: "medium", estimatedMonthlyCost: 75, relatedGap: gap.area, actionType: "add-flood" });
        }
      }

      const seen = new Set<string>();
      const uniqueRecs = recommendations.filter((r) => { if (seen.has(r.title)) return false; seen.add(r.title); return true; });
      const totalMonthlyCost = uniqueRecs.reduce((sum, r) => sum + r.estimatedMonthlyCost, 0);

      return {
        content: [{ type: "text", text: `${uniqueRecs.length} recommendations. Est. additional: ${fmt(totalMonthlyCost)}/mo.` }],
        structuredContent: { recommendations: uniqueRecs, totalMonthlyCost, policyCount: policies.length },
      };
    },
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // DATA TOOLS (no UI)
  // ══════════════════════════════════════════════════════════════════════════════

  // 5. search-policies
  server.tool(
    "search-policies",
    "Search and filter insurance policies by type, carrier, or minimum coverage amount",
    SearchSchema,
    async ({ type, carrier, minCoverage }) => {
      const policies = await searchPolicies({ type, carrier, minCoverage });
      const summary = policies
        .map((p) => `• ${p.id}: ${p.carrier} ${p.type} — ${p.policyNumber} — ${fmt(p.premiumMonthly)}/mo`)
        .join("\n");
      return { content: [{ type: "text", text: policies.length > 0 ? `Found ${policies.length} policies:\n${summary}` : "No policies match your criteria." }] };
    },
  );

  // 6. add-policy
  server.tool(
    "add-policy",
    "Add a new insurance policy to the comparison set",
    { policy: z.string().describe("Full policy object as JSON string") },
    async ({ policy: policyJson }) => {
      const policy = JSON.parse(policyJson) as Policy;
      await upsertPolicy(policy);
      return { content: [{ type: "text", text: `Added ${policy.carrier} ${policy.type} policy (${policy.id}).` }] };
    },
  );

  // 7. remove-policy
  server.tool(
    "remove-policy",
    "Remove a policy from the comparison set",
    { policyId: z.string().describe("The ID of the policy to remove") },
    async ({ policyId }) => {
      const deleted = await deletePolicy(policyId);
      return { content: [{ type: "text", text: deleted ? `Removed policy ${policyId}.` : `Policy ${policyId} not found.` }] };
    },
  );

  // 8. get-policy-summary
  server.tool(
    "get-policy-summary",
    "Get a detailed text summary of a specific policy for model context",
    { policyId: z.string().describe("The policy ID") },
    async ({ policyId }) => {
      const p = await getPolicy(policyId);
      if (!p) return { content: [{ type: "text", text: `Policy ${policyId} not found.` }] };
      const lines = [
        `📋 ${p.carrier} — ${p.type.toUpperCase()} Policy`,
        `Policy #: ${p.policyNumber}`, `Holder: ${p.holderName}`,
        `Effective: ${p.effectiveDate} to ${p.expirationDate}`,
        `Premium: ${fmt(p.premiumMonthly)}/mo (${fmt(p.premiumAnnual)}/yr)`,
        p.propertyAddress ? `Property: ${p.propertyAddress}` : null,
        p.vehicleInfo ? `Vehicle: ${p.vehicleInfo}` : null,
        p.policySubtype ? `Type: ${p.policySubtype}` : null,
        "", "COVERAGES:",
        ...p.coverages.map((c) => `  • ${c.type}: ${c.limit > 0 ? fmt(c.limit) : "Included"} (ded: ${fmt(c.deductible)})`),
        "", `EXCLUSIONS: ${p.exclusions.join(", ")}`,
        `ENDORSEMENTS: ${p.endorsements.join(", ")}`,
        `Rating: ${p.rating}/5 | Claims: ${p.claimsHistory}`,
      ];
      return { content: [{ type: "text", text: lines.filter(Boolean).join("\n") }] };
    },
  );

  // 9. calculate-gap-score
  server.tool(
    "calculate-gap-score",
    "Calculate a numeric coverage gap analysis score with category breakdown",
    PolicyIdsOptionalSchema,
    async ({ policyIds }) => {
      let policies: Policy[];
      if (policyIds && policyIds.length > 0) {
        policies = (await Promise.all(policyIds.map((id) => getPolicy(id)))).filter(Boolean) as Policy[];
      } else {
        policies = await getAllPolicies();
      }
      const { gaps, score, breakdown } = analyzeGaps(policies);
      const lines = [
        `📊 Coverage Gap Score: ${score}/100`, "",
        "BREAKDOWN:", ...Object.entries(breakdown).map(([cat, s]) => `  ${cat}: ${s}/100`),
        "", `GAPS: ${gaps.length}`,
        ...gaps.map((g) => `  [${g.severity.toUpperCase()}] ${g.area}: ${g.currentCoverage} → ${g.recommendedCoverage}`),
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  // 10. get-quote-estimate
  server.tool(
    "get-quote-estimate",
    "Estimate the premium impact of a coverage change such as increasing limits or adding coverage",
    QuoteSchema,
    async ({ policyId, changeType }) => {
      const policy = await getPolicy(policyId);
      if (!policy) return { content: [{ type: "text", text: `Policy ${policyId} not found.` }] };
      const result = estimateQuote(changeType, policy.premiumMonthly, {});
      const lines = [
        `💰 Quote for ${policy.carrier} ${policy.type}`,
        `Change: ${changeType}`, `Current: ${fmt(policy.premiumMonthly)}/mo`,
        `Estimated: ${fmt(result.estimatedPremium)}/mo (+${fmt(result.difference)}/mo)`,
        "", result.explanation,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // UI RESOURCES
  // ══════════════════════════════════════════════════════════════════════════════

  const widgets = [
    { uri: comparisonUri, file: "policy-comparison.html" },
    { uri: gapAnalysisUri, file: "gap-analysis.html" },
    { uri: policyDetailUri, file: "policy-detail.html" },
    { uri: recommendationUri, file: "recommendation.html" },
  ];

  for (const { uri, file } of widgets) {
    registerAppResource(
      server, uri, uri,
      { mimeType: RESOURCE_MIME_TYPE },
      async (): Promise<ReadResourceResult> => {
        const html = await readWidgetHtml(file);
        return { contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
      },
    );
  }

  return server;
}
