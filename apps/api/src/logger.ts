import { type LevelWithSilent, type Logger, pino } from "pino";

export type { Logger };

const SAIGON_OFFSET_MS = 7 * 60 * 60 * 1000;

/** ISO-8601 timestamp in Asia/Saigon (UTC+7, no DST), e.g. 2026-10-08T17:07:00.123+07:00. */
function saigonTimestamp(): string {
	const local = new Date(Date.now() + SAIGON_OFFSET_MS).toISOString();
	return `,"time":"${local.replace("Z", "+07:00")}"`;
}

export function createLogger(level: LevelWithSilent): Logger {
	return pino({
		level,
		base: { service: "localman-api" },
		timestamp: saigonTimestamp,
		redact: {
			paths: ["req.headers.authorization", "req.headers.cookie"],
			censor: "[redacted]",
		},
	});
}
