import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLaikaMcpServer } from "../mcp/server.js";
import { createToolContext } from "../mcp/tools/context.js";

// stdout carries the JSON-RPC stream; harness logs must go to stderr.
console.log = (...args: unknown[]) => console.error(...args);

const server = createLaikaMcpServer(createToolContext());

server.connect(new StdioServerTransport()).catch((err) => {
  console.error(err);
  process.exit(1);
});
