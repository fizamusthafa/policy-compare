import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
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
  Shield20Filled,
  Calendar20Regular,
  Money20Regular,
} from "@fluentui/react-icons";

interface Coverage {
  type: string;
  limit: number;
  deductible: number;
  category: string;
}

interface Policy {
  id: string;
  type: string;
  carrier: string;
  policyNumber: string;
  holderName: string;
  effectiveDate: string;
  expirationDate: string;
  premiumMonthly: number;
  premiumAnnual: number;
  propertyAddress?: string;
  vehicleInfo?: string;
  policySubtype?: string;
  coverages: Coverage[];
  exclusions: string[];
  endorsements: string[];
  rating: number;
  claimsHistory: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const typeLabels: Record<string, string> = {
  homeowners: "🏠 Homeowner's",
  auto: "🚗 Auto",
  life: "💗 Life",
  umbrella: "☂️ Umbrella",
};

function PolicyDetailApp() {
  const [policy, setPolicy] = useState<Policy | null>(null);

  const { app, error } = useApp({
    appInfo: { name: "Policy Detail", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = async (result: CallToolResult) => {
        if (result.structuredContent) {
          setPolicy((result.structuredContent as { policy: Policy }).policy);
        }
      };
      app.ontoolinput = async () => {};
      app.onerror = console.error;
    },
  });

  const handleShowGapAnalysis = useCallback(async () => {
    if (!app || !policy) return;
    try {
      await app.callServerTool({
        name: "show-gap-analysis",
        arguments: { policyIds: [policy.id] },
      });
    } catch (e) {
      console.error(e);
    }
  }, [app, policy]);

  if (error) return <div style={{ padding: 16, color: "red" }}>Error: {error.message}</div>;
  if (!app) return <div style={{ padding: 16 }}>Connecting...</div>;
  if (!policy) return <div style={{ padding: 16 }}>Loading policy details...</div>;

  const totalCoverage = policy.coverages.reduce((sum, c) => sum + c.limit, 0);
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  return (
    <FluentProvider theme={isDark ? webDarkTheme : webLightTheme}>
      <div style={{ padding: 16, fontFamily: tokens.fontFamilyBase }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Shield20Filled style={{ fontSize: 28, color: tokens.colorBrandForeground1 }} />
          <div>
            <Title2>{policy.carrier}</Title2>
            <Caption1>{typeLabels[policy.type] ?? policy.type} — {policy.policyNumber}</Caption1>
          </div>
          <Badge appearance="filled" color="informative" style={{ marginLeft: "auto", padding: "4px 10px" }}>
            ⭐ {policy.rating}/5
          </Badge>
        </div>

        {/* Key Info Cards */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <Card style={{ flex: "1 1 150px", padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Money20Regular />
              <Caption1 style={{ fontWeight: 600 }}>Premium</Caption1>
            </div>
            <Title3>{fmt(policy.premiumMonthly)}<Caption1>/mo</Caption1></Title3>
            <Caption1>{fmt(policy.premiumAnnual)}/year</Caption1>
          </Card>
          <Card style={{ flex: "1 1 150px", padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar20Regular />
              <Caption1 style={{ fontWeight: 600 }}>Effective Period</Caption1>
            </div>
            <Body1>{policy.effectiveDate}</Body1>
            <Caption1>to {policy.expirationDate}</Caption1>
          </Card>
          <Card style={{ flex: "1 1 150px", padding: 12 }}>
            <Caption1 style={{ fontWeight: 600 }}>Policyholder</Caption1>
            <Body1>{policy.holderName}</Body1>
            {policy.propertyAddress && <Caption1>{policy.propertyAddress}</Caption1>}
            {policy.vehicleInfo && <Caption1>{policy.vehicleInfo}</Caption1>}
            {policy.policySubtype && <Badge appearance="outline">{policy.policySubtype}</Badge>}
          </Card>
          <Card style={{ flex: "1 1 150px", padding: 12 }}>
            <Caption1 style={{ fontWeight: 600 }}>Total Coverage</Caption1>
            <Title3>{fmt(totalCoverage)}</Title3>
            <Caption1>{policy.coverages.length} types</Caption1>
          </Card>
        </div>

        {/* Coverage Table */}
        <Title3 style={{ marginBottom: 8 }}>Coverage Details</Title3>
        <Table style={{ width: "100%", marginBottom: 16 }}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Coverage Type</TableHeaderCell>
              <TableHeaderCell>Limit</TableHeaderCell>
              <TableHeaderCell>Deductible</TableHeaderCell>
              <TableHeaderCell>Category</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {policy.coverages.map((cov, i) => (
              <TableRow key={i}>
                <TableCell><Body1 style={{ fontWeight: 600 }}>{cov.type}</Body1></TableCell>
                <TableCell><Body1>{cov.limit > 0 ? fmt(cov.limit) : "Included"}</Body1></TableCell>
                <TableCell><Body1>{cov.deductible > 0 ? fmt(cov.deductible) : "None"}</Body1></TableCell>
                <TableCell>
                  <Badge appearance="outline">{cov.category}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Exclusions */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Title3 style={{ marginBottom: 8 }}>Exclusions</Title3>
            {policy.exclusions.map((exc, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ color: "#f44336" }}>✕</span>
                <Body2>{exc}</Body2>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Title3 style={{ marginBottom: 8 }}>Endorsements</Title3>
            {policy.endorsements.map((end, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ color: "#4caf50" }}>✓</span>
                <Body2>{end}</Body2>
              </div>
            ))}
          </div>
        </div>

        <Divider style={{ marginBottom: 12 }} />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button appearance="primary" onClick={handleShowGapAnalysis}>
            Analyze Gaps
          </Button>
          <Caption1 style={{ alignSelf: "center", opacity: 0.6 }}>
            Claims history: {policy.claimsHistory} claim{policy.claimsHistory !== 1 ? "s" : ""}
          </Caption1>
        </div>
      </div>
    </FluentProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PolicyDetailApp />
  </StrictMode>,
);
