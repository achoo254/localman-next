import { setTimeout as delay } from "node:timers/promises";
import type { Logger } from "../../../logger.js";

export const TELEGRAM_API_BASE_URL = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 10_000;

/** `blocked`: Telegram answered 403 (no Start pressed, or bot blocked). */
export type TelegramSendResult = "sent" | "blocked" | "failed";

export interface TelegramBotClientOptions {
	readonly token: string;
	readonly logger: Logger;
	/** Bot API origin; tests point it at a local fake. */
	readonly apiBaseUrl?: string;
	/** Attempts per message, the first included. */
	readonly maxAttempts?: number;
	/** First backoff step; doubles per attempt when Telegram gives no hint. */
	readonly baseDelayMs?: number;
	/** Longest wait between attempts; a longer `retry_after` gives up. */
	readonly maxDelayMs?: number;
	readonly sleep?: (ms: number) => Promise<void>;
}

interface BotApiResponse {
	readonly ok?: boolean;
	readonly description?: string;
	readonly retryAfterSeconds?: number;
}

async function readBotResponse(response: Response): Promise<BotApiResponse> {
	const body: unknown = await response.json().catch(() => null);
	if (typeof body !== "object" || body === null) return {};
	const parameters = "parameters" in body ? body.parameters : undefined;
	const retryAfter =
		typeof parameters === "object" &&
		parameters !== null &&
		"retry_after" in parameters &&
		typeof parameters.retry_after === "number"
			? parameters.retry_after
			: undefined;
	return {
		ok: "ok" in body && body.ok === true,
		description:
			"description" in body && typeof body.description === "string"
				? body.description.slice(0, 200)
				: undefined,
		retryAfterSeconds: retryAfter,
	};
}

/**
 * Minimal Telegram Bot API client for Localman's own bot. Rate limits (429)
 * and server errors are retried, honouring `retry_after` when given and
 * otherwise backing off exponentially, both capped. The token is part of
 * the request URL, so URLs are never logged.
 */
export class TelegramBotClient {
	private readonly baseUrl: string;
	private readonly maxAttempts: number;
	private readonly baseDelayMs: number;
	private readonly maxDelayMs: number;
	private readonly sleep: (ms: number) => Promise<void>;

	constructor(private readonly options: TelegramBotClientOptions) {
		this.baseUrl = options.apiBaseUrl ?? TELEGRAM_API_BASE_URL;
		this.maxAttempts = options.maxAttempts ?? 3;
		this.baseDelayMs = options.baseDelayMs ?? 1_000;
		this.maxDelayMs = options.maxDelayMs ?? 10_000;
		this.sleep = options.sleep ?? ((ms) => delay(ms));
	}

	async sendMessage(chatId: string, text: string): Promise<TelegramSendResult> {
		const url = `${this.baseUrl}/bot${this.options.token}/sendMessage`;
		const { logger } = this.options;
		for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
			let status: number | undefined;
			let reply: BotApiResponse = {};
			try {
				const response = await fetch(url, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						chat_id: chatId,
						text,
						link_preview_options: { is_disabled: true },
					}),
					signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				});
				status = response.status;
				reply = await readBotResponse(response);
				if (response.ok && reply.ok) return "sent";
				if (status === 403) return "blocked";
			} catch (error) {
				logger.warn(
					{ attempt, reason: error instanceof Error ? error.name : "unknown" },
					"Telegram request failed",
				);
			}
			const retryable = status === undefined || status === 429 || status >= 500;
			const wait =
				reply.retryAfterSeconds !== undefined
					? reply.retryAfterSeconds * 1000
					: this.baseDelayMs * 2 ** (attempt - 1);
			if (
				!retryable ||
				attempt === this.maxAttempts ||
				wait > this.maxDelayMs
			) {
				logger.warn(
					{ status, attempt, description: reply.description },
					"Telegram message not delivered",
				);
				return "failed";
			}
			await this.sleep(wait);
		}
		return "failed";
	}
}
