/**
 * Child process of the E2E stack: an echo server on 127.0.0.1 for the API
 * client specs. Every answer repeats the request as received (method,
 * path, headers in order with repeats, body). Routes:
 * - `/cors/*`: CORS allowed for every origin, preflight answered (204);
 * - `/plain/*`: no CORS header, so a browser refuses the answer;
 * - `/redirect/*`: 302 to `/cors/redirected`, with CORS so a browser follows it;
 * - `/slow?ms=N`: answers after N ms (capped at 10 s), with CORS.
 */
import {
	type IncomingMessage,
	type ServerResponse,
	createServer,
} from "node:http";
import { PORTS } from "./ports.js";

const CORS: Record<string, string> = {
	"access-control-allow-origin": "*",
	"access-control-allow-methods": "*",
	"access-control-allow-headers": "*",
	"access-control-expose-headers": "*",
};
const MAX_SLOW_MS = 10_000;

function echoBody(req: IncomingMessage, body: Buffer): string {
	const headers: [string, string][] = [];
	for (let i = 0; i + 1 < req.rawHeaders.length; i += 2) {
		headers.push([req.rawHeaders[i] ?? "", req.rawHeaders[i + 1] ?? ""]);
	}
	return JSON.stringify({
		method: req.method ?? "",
		url: req.url ?? "",
		headers,
		body: body.toString("utf8"),
		bodyBase64: body.toString("base64"),
	});
}

function send(
	res: ServerResponse,
	status: number,
	headers: Record<string, string>,
	payload: string,
): void {
	res.writeHead(status, { "content-type": "application/json", ...headers });
	res.end(payload);
}

/** Milliseconds asked by `/slow?ms=N`, 0 when absent or not a number. */
function slowMs(url: string): number {
	const raw = new URL(url, "http://echo.invalid").searchParams.get("ms");
	const ms = Number(raw ?? 0);
	return Number.isFinite(ms) ? Math.min(Math.max(ms, 0), MAX_SLOW_MS) : 0;
}

const server = createServer((req, res) => {
	const chunks: Buffer[] = [];
	req.on("data", (chunk: Buffer) => chunks.push(chunk));
	req.on("end", () => {
		const body = Buffer.concat(chunks);
		const path = (req.url ?? "/").split("?")[0] ?? "/";
		if (path === "/health") return send(res, 200, {}, "{}");
		if (path.startsWith("/redirect/")) {
			res.writeHead(302, { ...CORS, location: "/cors/redirected" });
			return res.end();
		}
		if (path.startsWith("/cors/") && req.method === "OPTIONS") {
			res.writeHead(204, CORS);
			return res.end();
		}
		if (path === "/slow") {
			return setTimeout(
				() => send(res, 200, CORS, echoBody(req, body)),
				slowMs(req.url ?? ""),
			);
		}
		if (path.startsWith("/cors/")) {
			return send(res, 200, CORS, echoBody(req, body));
		}
		return send(res, 200, {}, echoBody(req, body));
	});
});

server.listen(PORTS.echo, "127.0.0.1", () => {
	console.log(`echo server on 127.0.0.1:${PORTS.echo}`);
});

const stop = (): void => {
	server.close();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
