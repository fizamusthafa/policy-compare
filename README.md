# Policy Compare — Declarative Agent with MCP Server & Rich UI

A Microsoft 365 Copilot Declarative Agent that connects to the **Policy Compare MCP Server**, enabling insurance policy comparison and gap analysis through natural language. The MCP server uses **[MCP Apps](https://github.com/modelcontextprotocol/ext-apps)** (`@modelcontextprotocol/ext-apps`) to render rich, interactive widgets directly inside the Copilot chat — including policy comparison matrices, gap analysis charts, policy detail cards, and coverage recommendations.

Built with the [Agents Toolkit (ATK)](https://aka.ms/teams-toolkit) in VS Code.

## What This Agent Can Do

### Rich UI Tools (render interactive widgets in chat)

| Tool | Description |
|------|-------------|
| `show-policy-comparison` | Side-by-side comparison matrix of 2-4 policies with color-coded cells (green = better, red = worse) and category filtering |
| `show-gap-analysis` | Visual gap report with coverage score gauge, category breakdown bars, severity ratings, and "What could go wrong?" scenarios |
| `show-policy-detail` | Detailed entity card for a single policy: carrier info, coverage table, exclusions, endorsements, premium details |
| `show-recommendation` | Actionable recommendation cards with priority levels, estimated cost impact, and "Request Quote" buttons |

### Data Tools

| Tool | Description |
|------|-------------|
| `search-policies` | Search/filter policies by type, carrier, or coverage amount |
| `add-policy` | Add a new policy to the comparison set |
| `remove-policy` | Remove a policy from comparison |
| `get-policy-summary` | Text summary of a specific policy for model context |
| `calculate-gap-score` | Numeric gap analysis score with category breakdown |
| `get-quote-estimate` | Estimate premium impact for a coverage change |

## Sample Prompts

| Prompt | What it does |
|--------|-------------|
| *Compare my current homeowner's policy with these two alternatives* | Opens the comparison widget with side-by-side policy matrix |
| *Where are the gaps in my insurance coverage?* | Runs gap analysis across all policies with score and risk scenarios |
| *Show me the details of my State Farm auto policy* | Opens a detailed policy card with coverage table |
| *What happens if I increase my liability limit to $500K?* | Estimates premium change and explains the impact |
| *I just bought a boat — do any of my current policies cover it?* | Analyzes existing coverage for watercraft and identifies gaps |
| *Compare the cheapest vs most comprehensive home insurance options* | Opens comparison widget highlighting cost-value differences |
| *What's the gap in my portfolio if I drop the umbrella policy?* | Shows gap analysis impact of removing umbrella coverage |

## Prerequisites

- [Node.js](https://nodejs.org/) 18, 20, or 22
- [Microsoft 365 Agents Toolkit](https://aka.ms/teams-toolkit) VS Code extension (v5.0.0+)
- [Microsoft 365 Copilot license](https://learn.microsoft.com/microsoft-365-copilot/extensibility/prerequisites#prerequisites)
- A [Microsoft 365 developer account](https://docs.microsoft.com/microsoftteams/platform/toolkit/accounts)

## Getting Started

1. **Create a file** `.env.dev` (use `.env.dev.sample`) inside the **env** folder.

2. **Run the setup commands:**

   Run all scripts from `src/mcpserver/`:

   1. **Install dependencies** — `npm run install:all`
   2. **Start Azurite** (local storage emulator) — `npm run start:azurite` (separate terminal)
   3. **Seed the database** — `npm run seed`
   4. **Build widgets** — `npm run build:widgets`
   5. **Start the MCP server** — `npm run dev:server` (runs on `http://localhost:3001/mcp`)

3. **Create a dev tunnel:**

   ```bash
   devtunnel host -p 3001 --allow-anonymous
   ```

   Copy the forwarded URL and update `appPackage/ai-plugin.json`:

   ```json
   "spec": {
     "url": "https://<your-tunnel-url>/mcp"
   }
   ```

4. **Create `.env`** in `src/mcpserver/server/`:

   ```bash
   cp .env.sample .env
   ```

5. **Provision** — Use the **Provision** button from Agents Toolkit's **LifeCycle** panel.

## Test the Agent

1. Open [https://m365.cloud.microsoft/chat](https://m365.cloud.microsoft/chat)
2. Select your agent in the sidebar
3. Try a sample prompt from the table above
4. Allow the agent to connect to the MCP server when prompted
5. The agent renders the interactive UI widget in chat

## Project Structure

| Folder | Description |
|--------|-------------|
| `appPackage/` | Agent manifests — `ai-plugin.json`, `declarativeAgent.json`, `manifest.json` |
| `src/mcpserver/server/` | MCP server — Express + StreamableHTTP transport, Azure Table Storage data layer |
| `src/mcpserver/widgets/` | React 18 + Fluent UI v9 widgets built as single-file HTML via MCP Apps SDK |
| `src/mcpserver/assets/` | Built widget HTML files (output of widget build) |
| `src/mcpserver/db/` | Seed data (9 realistic insurance policies) |
| `env/` | Local environment files |
| `m365agents.yml` | ATK lifecycle configuration |

## Mock Data

The seed data includes 9 realistic insurance policies:
- **3 Homeowner's** — State Farm (basic), Allstate (comprehensive), USAA (mid-range)
- **3 Auto** — GEICO (liability-only), Progressive (full coverage), State Farm (high-deductible)
- **2 Life** — Northwestern Mutual (20-year term), New York Life (whole life)
- **1 Umbrella** — Chubb ($1M personal umbrella)

## Learn More

- [Build Declarative Agents](https://learn.microsoft.com/microsoft-365-copilot/extensibility/build-declarative-agents)
- [MCP Apps](https://github.com/modelcontextprotocol/ext-apps)
- [Model Context Protocol](https://modelcontextprotocol.io/)
