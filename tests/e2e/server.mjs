import { spawn, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const directory = path.resolve(process.env.CLEAR_E2E_DATA_DIR ?? "");
if (path.dirname(directory) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith("clear-e2e-")) {
  throw new Error("The HTTPS browser server requires this test run's isolated temporary directory.");
}
const origin = new URL("https://localhost:3100");
const upstreamPort = 3101;
const certificateDirectory = path.join(directory, "tls");
mkdirSync(certificateDirectory, { recursive: true, mode: 0o700 });

const candidates = [
  process.env.CLEAR_E2E_OPENSSL,
  "openssl",
  ...(process.platform === "win32" ? [
    path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Git", "usr", "bin", "openssl.exe"),
    path.join(process.env.LOCALAPPDATA ?? "", "Programs", "Git", "usr", "bin", "openssl.exe"),
  ] : []),
].filter(Boolean);
const openssl = candidates.find((candidate) => spawnSync(candidate, ["version"], { stdio: "ignore", windowsHide: true }).status === 0);
if (!openssl) throw new Error("Browser HTTPS tests need OpenSSL. Git for Windows and Ubuntu provide it; CLEAR_E2E_OPENSSL may name its executable.");
const keyPath = path.join(certificateDirectory, "key.pem");
const certificatePath = path.join(certificateDirectory, "certificate.pem");
const certificate = spawnSync(openssl, [
  "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "2",
  "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1",
  "-keyout", keyPath, "-out", certificatePath,
], { stdio: "ignore", windowsHide: true, timeout: 30_000 });
if (certificate.status !== 0) throw new Error("The temporary browser HTTPS certificate could not be created.");
chmodSync(keyPath, 0o600);

const next = spawn(process.execPath, [
  path.resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(upstreamPort),
], { stdio: "inherit", env: process.env, windowsHide: true });
let stopping = false;
let nextExited = false;
const server = https.createServer({ key: readFileSync(keyPath), cert: readFileSync(certificatePath) }, (request, response) => {
  if (request.headers.host !== origin.host) {
    response.writeHead(400);
    response.end("Unexpected browser-test host.");
    return;
  }
  const upstream = http.request({
    hostname: "127.0.0.1",
    port: upstreamPort,
    method: request.method,
    path: request.url,
    headers: {
      ...forwardHeaders(request.headers),
      host: origin.host,
      "x-forwarded-host": origin.host,
      "x-forwarded-proto": "https",
      "x-forwarded-for": "127.0.0.1",
    },
  }, (result) => {
    response.writeHead(result.statusCode ?? 502, forwardHeaders(result.headers));
    result.pipe(response);
  });
  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502);
    response.end("The local browser-test app is unavailable.");
  });
  request.on("aborted", () => upstream.destroy());
  response.on("close", () => upstream.destroy());
  request.pipe(upstream);
});

function forwardHeaders(input) {
  const headers = { ...input };
  const connectionHeaders = String(input.connection ?? "").split(",").map((name) => name.trim().toLowerCase());
  for (const name of [...connectionHeaders, "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]) {
    delete headers[name];
  }
  return headers;
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  server.closeAllConnections();
  server.close();
  if (!nextExited) next.kill("SIGTERM");
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
server.on("error", () => stop(1));
next.on("error", () => stop(1));
next.on("exit", (code) => {
  nextExited = true;
  if (!stopping) stop(code || 1);
});

async function ready() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline && !stopping) {
    const healthy = await new Promise((resolve) => {
      const check = http.get(`http://127.0.0.1:${upstreamPort}/`, (response) => {
        response.resume();
        resolve(response.statusCode !== undefined && response.statusCode < 500);
      });
      check.setTimeout(1_000, () => check.destroy());
      check.on("error", () => resolve(false));
    });
    if (healthy) return;
    await delay(100);
  }
  throw new Error("The isolated production app did not become ready.");
}

try {
  await ready();
  if (!stopping) server.listen(Number(origin.port), origin.hostname);
} catch (error) {
  if (!stopping) console.error(error instanceof Error ? error.message : "The browser-test server did not start.");
  stop(1);
}
