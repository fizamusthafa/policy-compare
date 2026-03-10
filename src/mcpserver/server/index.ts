import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { Request, Response } from "express";
import { createServer } from "./tools.js";
import dotenv from "dotenv";

dotenv.config();

const port = parseInt(process.env.PORT ?? "3001", 10);

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

app.all("/mcp", async (req: Request, res: Response) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

const httpServer = app.listen(port, () => {
  console.log(`Policy Compare MCP server listening on http://localhost:${port}/mcp`);
});

const shutdown = () => {
  console.log("\nShutting down...");
  httpServer.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
