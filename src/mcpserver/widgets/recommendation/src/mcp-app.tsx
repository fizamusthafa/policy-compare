import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Badge,
  Button,
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
  ArrowUp20Filled,
  Lightbulb20Regular,
  Money20Regular,
} from "@fluentui/react-icons";

interface Recommendation {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  estimatedMonthlyCost: number;
  relatedGap: string;
  actionType: string;
}

interface RecommendationData {
  recommendations: Recommendation[];
  totalMonthlyCost: number;
  policyCount: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const priorityConfig = {
  high: { color: "#d32f2f", bg: "rgba(211,47,47,0.08)", badge: "danger" as const, label: "High Priority" },
  medium: { color: "#ed6c02", bg: "rgba(237,108,2,0.08)", badge: "warning" as const, label: "Medium" },
  low: { color: "#0288d1", bg: "rgba(2,136,209,0.08)", badge: "informative" as const, label: "Low" },
};

function RecommendationApp() {
  const [data, setData] = useState<RecommendationData | null>(null);

  const { app, error } = useApp({
    appInfo: { name: "Recommendations", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = async (result: CallToolResult) => {
        if (result.structuredContent) {
          setData(result.structuredContent as RecommendationData);
        }
      };
      app.ontoolinput = async () => {};
      app.onerror = console.error;
    },
  });

  const handleGetQuote = useCallback(
    async (actionType: string) => {
      if (!app) return;
      try {
        await app.callServerTool({
          name: "get-quote-estimate",
          arguments: { policyId: "HOME-001", changeType: actionType },
        });
      } catch (e) {
        console.error("Failed to get quote:", e);
      }
    },
    [app],
  );

  if (error) return <div style={{ padding: 16, color: "red" }}>Error: {error.message}</div>;
  if (!app) return <div style={{ padding: 16 }}>Connecting...</div>;
  if (!data) return <div style={{ padding: 16 }}>Loading recommendations...</div>;

  const { recommendations, totalMonthlyCost } = data;
  const highCount = recommendations.filter((r) => r.priority === "high").length;

  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  return (
    <FluentProvider theme={isDark ? webDarkTheme : webLightTheme}>
      <div style={{ padding: 16, fontFamily: tokens.fontFamilyBase }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Lightbulb20Regular />
            <Title2>Coverage Recommendations</Title2>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Badge appearance="filled" color="danger" style={{ padding: "4px 8px" }}>
              {highCount} High Priority
            </Badge>
            <div style={{ textAlign: "right" }}>
              <Caption1>Est. total additional cost</Caption1>
              <Title3 style={{ display: "block" }}>{fmt(totalMonthlyCost)}/mo</Title3>
            </div>
          </div>
        </div>

        <Divider style={{ marginBottom: 16 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {recommendations.map((rec, i) => {
            const cfg = priorityConfig[rec.priority];
            return (
              <Card
                key={i}
                style={{
                  padding: 16,
                  borderLeft: `4px solid ${cfg.color}`,
                  background: cfg.bg,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ArrowUp20Filled style={{ color: cfg.color }} />
                    <Body1 style={{ fontWeight: 700, fontSize: 16 }}>{rec.title}</Body1>
                    <Badge appearance="outline" color={cfg.badge}>{cfg.label}</Badge>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Money20Regular />
                    <Body1 style={{ fontWeight: 700, color: cfg.color }}>
                      +{fmt(rec.estimatedMonthlyCost)}/mo
                    </Body1>
                  </div>
                </div>

                <Body2 style={{ marginBottom: 12 }}>{rec.description}</Body2>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <Caption1 style={{ opacity: 0.7 }}>Related gap: {rec.relatedGap}</Caption1>
                  <Button
                    appearance="outline"
                    size="small"
                    onClick={() => handleGetQuote(rec.actionType)}
                  >
                    Request Quote
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {recommendations.length === 0 && (
          <Card style={{ padding: 24, textAlign: "center" }}>
            <Title3>🎉 Great Coverage!</Title3>
            <Body1>No significant gaps found. Your coverage looks solid.</Body1>
          </Card>
        )}
      </div>
    </FluentProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RecommendationApp />
  </StrictMode>,
);
