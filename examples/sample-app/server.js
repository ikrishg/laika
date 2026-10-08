import http from "node:http";

const PORT = Number(process.env.PORT ?? 3456);
const simulateError = process.env.SAMPLE_APP_ERROR === "1";

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    if (simulateError) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "simulated_outage" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "sample-app" }));
    return;
  }

  if (req.url === "/api/greet") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "hello from sample-app" }));
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`sample-app listening on http://localhost:${PORT}`);
});
