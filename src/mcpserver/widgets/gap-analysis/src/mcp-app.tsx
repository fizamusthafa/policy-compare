import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Badge,
  Title2,
  Title3,
  Body1,
  Body2,
  Caption1,
  Card,
  Divider,
  tokens,
} from "@fluentui/react-components";
import {
  Warning20Filled,
  ErrorCircle20Filled,
  Info20Filled,
} from "@fluentui/react-icons";

interface GapItem {
  category: string;
  area: string;
  severity: "critical" | "warning" | "info";
  currentCoverage: string;
  recommendedCoverage: string;
  riskScenario: string;
}

interface GapData {
  gaps: GapItem[];
  score: number;
  breakdown: Record<string, number>;
  policies: { id: string; carrier: string; type: string }[];
}

const severityConfig = {
  critical: { icon: <ErrorCircle20Filled style={{ color: "#d32f2f" }} />, color: "#d32f2f", bg: "rgba(211,47,47,0.08)", badge: "danger" as const, label: "Critical" },
  warning: { icon: <Warning20Filled style={{ color: "#ed6c02" }} />, color: "#ed6c02", bg: "rgba(237,108,2,0.08)", badge: "warning" as const, label: "Warning" },
  info: { icon: <Info20Filled style={{ color: "#0288d1" }} />, color: "#0288d1", bg: "rgba(2,136,209,0.08)", badge: "informative" as const, label: "Info" },
};

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? "#4caf50" : score >= 60 ? "#ff9800" : "#f44336";
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div style={{ textAlign: "center" }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="45" fill="none" stroke="rgba(128,128,128,0.2)" strokeWidth="10" />
        <circle
          cx="60" cy="60" r="45" fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
        <text x="60" y="55" textAnchor="middle" fontSize="28" fontWeight="bold" fill="currentColor">
          {score}
        </text>
        <text x="60" y="75" textAnchor="middle" fontSize="12" fill="currentColor" opacity="0.7">
          / 100
        </text>
      </svg>
      <Body2 style={{ fontWeight: 600 }}>Coverage Score</Body2>
    </div>
  );
}

function BreakdownBar({ category, score }: { category: string; score: number }) {
  const color = score >= 80 ? "#4caf50" : score >= 60 ? "#ff9800" : "#f44336";
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <Caption1 style={{ fontWeight: 600 }}>{category}</Caption1>
        <Caption1>{score}/100</Caption1>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "rgba(128,128,128,0.15)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${score}%`,
            borderRadius: 4,
            background: color,
            transition: "width 1s ease",
          }}
        />
      </div>
    </div>
  );
}

function GapAnalysisApp() {
  const [data, setData] = useState<GapData | null>(null);

  const { app, error } = useApp({
    appInfo: { name: "Gap Analysis", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = async (result: CallToolResult) => {
        if (result.structuredContent) {
          setData(result.structuredContent as GapData);
        }
      };
      app.ontoolinput = async () => {};
      app.onerror = console.error;
    },
  });

  if (error) return <div style={{ padding: 16, color: "red" }}>Error: {error.message}</div>;
  if (!app) return <div style={{ padding: 16 }}>Connecting...</div>;
  if (!data) return <div style={{ padding: 16 }}>Loading gap analysis...</div>;

  const { gaps, score, breakdown } = data;
  const criticals = gaps.filter((g) => g.severity === "critical");
  const warnings = gaps.filter((g) => g.severity === "warning");
  const infos = gaps.filter((g) => g.severity === "info");

  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  return (
    <FluentProvider theme={isDark ? webDarkTheme : webLightTheme}>
      <div style={{ padding: 16, fontFamily: tokens.fontFamilyBase }}>
        <Title2 style={{ marginBottom: 16 }}>Coverage Gap Analysis</Title2>

        {/* Score and Breakdown */}
        <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
          <ScoreGauge score={score} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <Title3 style={{ marginBottom: 12 }}>Category Breakdown</Title3>
            {Object.entries(breakdown).map(([cat, s]) => (
              <BreakdownBar key={cat} category={cat} score={s} />
            ))}
          </div>
          <div style={{ minWidth: 150 }}>
            <Title3 style={{ marginBottom: 12 }}>Summary</Title3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Badge appearance="filled" color="danger" style={{ padding: "4px 8px" }}>
                {criticals.length} Critical
              </Badge>
              <Badge appearance="filled" color="warning" style={{ padding: "4px 8px" }}>
                {warnings.length} Warnings
              </Badge>
              <Badge appearance="filled" color="informative" style={{ padding: "4px 8px" }}>
                {infos.length} Info
              </Badge>
            </div>
          </div>
        </div>

        <Divider style={{ marginBottom: 16 }} />

        {/* Gaps List */}
        <Title3 style={{ marginBottom: 12 }}>Identified Gaps</Title3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {gaps.map((gap, i) => {
            const cfg = severityConfig[gap.severity];
            return (
              <Card key={i} style={{ padding: 16, borderLeft: `4px solid ${cfg.color}`, background: cfg.bg }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  {cfg.icon}
                  <Body1 style={{ fontWeight: 700 }}>{gap.area}</Body1>
                  <Badge appearance="outline" color={cfg.badge}>{cfg.label}</Badge>
                  <Caption1 style={{ marginLeft: "auto", opacity: 0.7 }}>{gap.category}</Caption1>
                </div>
                <div style={{ display: "flex", gap: 24, marginBottom: 8, flexWrap: "wrap" }}>
                  <div>
                    <Caption1 style={{ fontWeight: 600 }}>Current</Caption1>
                    <Body1>{gap.currentCoverage}</Body1>
                  </div>
                  <div>
                    <Caption1 style={{ fontWeight: 600 }}>Recommended</Caption1>
                    <Body1 style={{ color: cfg.color, fontWeight: 600 }}>{gap.recommendedCoverage}</Body1>
                  </div>
                </div>
                <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(128,128,128,0.08)" }}>
                  <Caption1 style={{ fontWeight: 600 }}>⚠️ What could go wrong?</Caption1>
                  <Body2 style={{ marginTop: 4 }}>{gap.riskScenario}</Body2>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </FluentProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GapAnalysisApp />
  </StrictMode>,
);
