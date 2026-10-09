import { type IncomingMessage, createServer } from "node:http";
import type { AddressInfo } from "node:net";

/** Host the fake reports for valid tokens; tests expect it. */
export const TURNSTILE_TEST_HOSTNAME = "localman.test";

/** Tokens the fake understands; anything else fails verification. */
export const TURNSTILE_TOKENS = {
	valid: "turnstile-pass",
	/** Solved on another site that shares the site key. */
	otherHost: "turnstile-other-host",
	/** Solved for another form (action). */
	otherAction: "turnstile-other-action",
} as const;

export interface FakeTurnstile {
	readonly url: string;
	/** Bodies received by siteverify, in order. */
	readonly requests: Record<string, unknown>[];
	/** Answer 500 to every request (Cloudflare down). */
	failing: boolean;
	reset(): void;
	close(): Promise<void>;
}

async function readJson(
	req: IncomingMessage,
): Promise<Record<string, unknown>> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) chunks.push(Buffer.from(chunk));
	const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
	return typeof parsed === "object" && parsed !== null
		? Object.fromEntries(Object.entries(parsed))
		: {};
}

function replyFor(token: unknown): Record<string, unknown> {
	const base = { hostname: TURNSTILE_TEST_HOSTNAME, action: "pro_interest" };
	switch (token) {
		case TURNSTILE_TOKENS.valid:
			return { success: true, ...base };
		case TURNSTILE_TOKENS.otherHost:
			return { success: true, ...base, hostname: "evil.example" };
		case TURNSTILE_TOKENS.otherAction:
			return { success: true, ...base, action: "contact" };
		default:
			return { success: false, "error-codes": ["invalid-input-response"] };
	}
}

/** TEST ONLY. A stand-in for Cloudflare Turnstile siteverify. */
export async function startFakeTurnstile(): Promise<FakeTurnstile> {
	const requests: Record<string, unknown>[] = [];
	const fake = {
		url: "",
		requests,
		failing: false,
		reset() {
			requests.length = 0;
			fake.failing = false;
		},
		close: () =>
			new Promise<void>((resolve) => {
				server.closeAllConnections();
				server.close(() => resolve());
			}),
	};
	const server = createServer((req, res) => {
		readJson(req)
			.then((body) => {
				requests.push(body);
				if (fake.failing) {
					res.writeHead(500).end();
					return;
				}
				res.writeHead(200, { "content-type": "application/json" });
				res.end(JSON.stringify(replyFor(body.response)));
			})
			.catch(() => {
				res.writeHead(400).end();
			});
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;
	fake.url = `http://127.0.0.1:${port}/siteverify`;
	return fake;
}
