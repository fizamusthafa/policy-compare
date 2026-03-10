import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useEffect, useState } from "react";
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
  Dropdown,
  Option,
  Title2,
  Title3,
  Body1,
  Caption1,
  Card,
  tokens,
} from "@fluentui/react-components";
import { Filter20Regular } from "@fluentui/react-icons";

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
  premiumMonthly: number;
  premiumAnnual: number;
  coverages: Coverage[];
  exclusions: string[];
  endorsements: string[];
  rating: number;
}

interface ComparisonData {
  policies: Policy[];
  filterCategory: string | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function getValueColor(values: number[], index: number, higherIsBetter: boolean): string {
  if (values.length < 2) return "transparent";
  const val = values[index];
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === min) return "rgba(255, 193, 7, 0.15)"; // yellow — equal
  const ratio = (val - min) / (max - min);
  const score = higherIsBetter ? ratio : 1 - ratio;
  if (score > 0.66) return "rgba(76, 175, 80, 0.15)";
  if (score > 0.33) return "rgba(255, 193, 7, 0.15)";
  return "rgba(244, 67, 54, 0.15)";
}

const CATEGORIES = ["all", "property", "liability", "vehicle", "life", "medical", "extras"];

function PolicyComparisonApp() {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { app, error } = useApp({
    appInfo: { name: "Policy Comparison", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = async (result: CallToolResult) => {
        if (result.structuredContent) {
          const d = result.structuredContent as ComparisonData;
          setData(d);
          if (d.filterCategory) setSelectedCategory(d.filterCategory);
        }
      };
      app.ontoolinput = async () => {};
      app.onerror = console.error;
    },
  });

  const handleShowGapAnalysis = useCallback(async () => {
    if (!app || !data) return;
    try {
      await app.callServerTool({
        name: "show-gap-analysis",
        arguments: { policyIds: data.policies.map((p) => p.id) },
      });
    } catch (e) {
      console.error("Failed to call gap analysis:", e);
    }
  }, [app, data]);

  if (error) return <div style={{ padding: 16, color: "red" }}>Error: {error.message}</div>;
  if (!app) return <div style={{ padding: 16 }}>Connecting...</div>;
  if (!data) return <div style={{ padding: 16 }}>Loading comparison data...</div>;

  const { policies } = data;

  // Get all unique coverage types across all policies
  const allCoverageTypes = [...new Set(policies.flatMap((p) => p.coverages.map((c) => c.type)))];
  const filteredTypes =
    selectedCategory === "all"
      ? allCoverageTypes
      : allCoverageTypes.filter((type) => {
          const cov = policies.flatMap((p) => p.coverages).find((c) => c.type === type);
          return cov?.category === selectedCategory;
        });

  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  return (
    <FluentProvider theme={isDark ? webDarkTheme : webLightTheme}>
      <div style={{ padding: 16, fontFamily: tokens.fontFamilyBase }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Title2>Policy Comparison</Title2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Filter20Regular />
            <Dropdown
              value={selectedCategory}
              onOptionSelect={(_, d) => setSelectedCategory(d.optionValue ?? "all")}
              style={{ minWidth: 140 }}
            >
              {CATEGORIES.map((c) => (
                <Option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </Option>
              ))}
            </Dropdown>
          </div>
        </div>

        {/* Overview Cards */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          {policies.map((p) => (
            <Card key={p.id} style={{ flex: "1 1 180px", padding: 12 }}>
              <Title3>{p.carrier}</Title3>
              <Caption1>{p.type.toUpperCase()} — {p.policyNumber}</Caption1>
              <Body1 style={{ marginTop: 8 }}>
                <strong>{fmt(p.premiumMonthly)}</strong>/mo ({fmt(p.premiumAnnual)}/yr)
              </Body1>
              <div style={{ marginTop: 4 }}>
                <Badge appearance="filled" color="informative">
                  ⭐ {p.rating}/5
                </Badge>
              </div>
            </Card>
          ))}
        </div>

        {/* Comparison Matrix */}
        <Table style={{ width: "100%" }}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell style={{ minWidth: 180 }}>Coverage</TableHeaderCell>
              {policies.map((p) => (
                <TableHeaderCell key={p.id} style={{ minWidth: 140 }}>
                  {p.carrier}
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTypes.map((coverageType) => {
              const values = policies.map((p) => {
                const cov = p.coverages.find((c) => c.type === coverageType);
                return cov?.limit ?? 0;
              });
              return (
                <TableRow key={coverageType}>
                  <TableCell>
                    <Body1 style={{ fontWeight: 600 }}>{coverageType}</Body1>
                  </TableCell>
                  {policies.map((p, i) => {
                    const cov = p.coverages.find((c) => c.type === coverageType);
                    return (
                      <TableCell
                        key={p.id}
                        style={{ backgroundColor: cov ? getValueColor(values, i, true) : "transparent" }}
                      >
                        {cov ? (
                          <div>
                            <Body1>{cov.limit > 0 ? fmt(cov.limit) : "Included"}</Body1>
                            {cov.deductible > 0 && (
                              <Caption1 style={{ display: "block", opacity: 0.7 }}>
                                Ded: {fmt(cov.deductible)}
                              </Caption1>
                            )}
                          </div>
                        ) : (
                          <Caption1 style={{ opacity: 0.5 }}>Not covered</Caption1>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}

            {/* Premium row */}
            <TableRow>
              <TableCell>
                <Body1 style={{ fontWeight: 600 }}>Monthly Premium</Body1>
              </TableCell>
              {policies.map((p, i) => {
                const premiums = policies.map((po) => po.premiumMonthly);
                return (
                  <TableCell
                    key={p.id}
                    style={{ backgroundColor: getValueColor(premiums, i, false) }}
                  >
                    <Body1 style={{ fontWeight: 600 }}>{fmt(p.premiumMonthly)}</Body1>
                  </TableCell>
                );
              })}
            </TableRow>

            {/* Exclusions row */}
            <TableRow>
              <TableCell>
                <Body1 style={{ fontWeight: 600 }}>Exclusions</Body1>
              </TableCell>
              {policies.map((p) => (
                <TableCell key={p.id}>
                  <Caption1>{p.exclusions.join(", ")}</Caption1>
                </TableCell>
              ))}
            </TableRow>

            {/* Endorsements row */}
            <TableRow>
              <TableCell>
                <Body1 style={{ fontWeight: 600 }}>Endorsements</Body1>
              </TableCell>
              {policies.map((p) => (
                <TableCell key={p.id}>
                  <Caption1>{p.endorsements.join(", ")}</Caption1>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>

        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <Button appearance="primary" onClick={handleShowGapAnalysis}>
            Show Gap Analysis
          </Button>
        </div>
      </div>
    </FluentProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PolicyComparisonApp />
  </StrictMode>,
);
