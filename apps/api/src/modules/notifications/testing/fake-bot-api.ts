import { type IncomingMessage, createServer } from "node:http";
import type { AddressInfo } from "node:net";

export interface ScriptedReply {
	readonly status: number;
	readonly retryAfter?: number;
	/** Hold the answer this long (a slow Bot API). */
	readonly delayMs?: number;
}

export interface SentMessage {
	readonly chat_id: unknown;
	readonly text: unknown;
}

export interface FakeBotApi {
	readonly url: string;
	/** `sendMessage` bodies received, in order. */
	readonly requests: SentMessage[];
	/** Requests answered so far. */
	answered(): number;
	/** Replies for the next requests; then every request succeeds. */
	script(replies: readonly ScriptedReply[]): void;
	reset(): void;
	close(): Promise<void>;
}

const DESCRIPTIONS: Readonly<Record<number, string>> = {
	403: "Forbidden: bot can't initiate conversation with a user",
	429: "Too Many Requests: retry later",
};

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

/** TEST ONLY. A scripted stand-in for the Telegram Bot API `sendMessage`. */
export async function startFakeBotApi(): Promise<FakeBotApi> {
	const requests: SentMessage[] = [];
	let replies: ScriptedReply[] = [];
	let answered = 0;
	const server = createServer((req, res) => {
		readJson(req)
			.then(async (body) => {
				requests.push({ chat_id: body.chat_id, text: body.text });
				const reply = replies.shift() ?? { status: 200 };
				if (reply.delayMs) {
					await new Promise((resolve) => setTimeout(resolve, reply.delayMs));
				}
				answered += 1;
				const ok = reply.status === 200;
				res.writeHead(reply.status, { "content-type": "application/json" });
				res.end(
					JSON.stringify(
						ok
							? { ok: true, result: { message_id: requests.length } }
							: {
									ok: false,
									error_code: reply.status,
									description: DESCRIPTIONS[reply.status] ?? "Bad Gateway",
									...(reply.retryAfter === undefined
										? {}
										: { parameters: { retry_after: reply.retryAfter } }),
								},
					),
				);
			})
			.catch(() => {
				res.writeHead(400).end();
			});
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;
	return {
		url: `http://127.0.0.1:${port}`,
		requests,
		answered: () => answered,
		script(next) {
			replies = [...next];
		},
		reset() {
			requests.length = 0;
			replies = [];
			answered = 0;
		},
		close: () =>
			new Promise((resolve) => {
				server.closeAllConnections();
				server.close(() => resolve());
			}),
	};
}
