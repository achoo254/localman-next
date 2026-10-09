import { Writable } from "node:stream";
import { type LevelWithSilent, pino } from "pino";
import type { Logger } from "../logger.js";

export interface LogCapture {
	readonly logger: Logger;
	/** Raw JSON lines written so far. */
	readonly lines: string[];
	/** Parsed entries whose `msg` is `message`. */
	entries(message: string): Record<string, unknown>[];
}

/** TEST ONLY. A pino logger writing its JSON lines into memory. */
export function captureLogs(level: LevelWithSilent = "info"): LogCapture {
	const lines: string[] = [];
	const sink = new Writable({
		write(chunk, _encoding, done) {
			lines.push(String(chunk));
			done();
		},
	});
	return {
		logger: pino({ level }, sink),
		lines,
		entries: (message) =>
			lines
				.map((line): Record<string, unknown> => JSON.parse(line))
				.filter((entry) => entry.msg === message),
	};
}
