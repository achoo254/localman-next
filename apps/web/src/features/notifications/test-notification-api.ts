import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
	expectRecord,
} from "../../lib/json-guards";

const WEB_PUSH_OUTCOMES = ["sent", "skipped", "failed"] as const;
const TELEGRAM_OUTCOMES = ["sent", "skipped", "blocked", "failed"] as const;

/** `skipped`: the channel is not ready (server, device or chat). */
export type WebPushOutcome = (typeof WEB_PUSH_OUTCOMES)[number];
/** `blocked`: the bot was refused (Start not pressed, or bot blocked). */
export type TelegramOutcome = (typeof TELEGRAM_OUTCOMES)[number];

/** Outcome per channel of `POST /api/v1/notifications/test`. */
export interface TestNotificationResult {
	inApp: "sent";
	webPush: WebPushOutcome;
	telegram: TelegramOutcome;
}

function expectOneOf<T extends string>(
	record: JsonRecord,
	key: string,
	allowed: readonly T[],
): T {
	const value = record[key];
	const match = allowed.find((option) => option === value);
	if (match === undefined) throw new InvalidResponseError(key);
	return match;
}

export function parseTestNotificationResult(
	data: unknown,
): TestNotificationResult {
	const root = expectRecord(data, "test notification result");
	return {
		inApp: expectOneOf(root, "inApp", ["sent"] as const),
		webPush: expectOneOf(root, "webPush", WEB_PUSH_OUTCOMES),
		telegram: expectOneOf(root, "telegram", TELEGRAM_OUTCOMES),
	};
}

/** Sends a test to every ready channel; 429 `RATE_LIMITED` within a minute. */
export async function sendTestNotification(): Promise<TestNotificationResult> {
	return parseTestNotificationResult(
		await apiRequest("/api/v1/notifications/test", { method: "POST" }),
	);
}
