import type http from "node:http";
import {
	DEFAULTS,
	type WsOpenResultMessage,
	stripHopByHopHeaders,
} from "@tunelo/shared";

export type WsOpenRefusal = Extract<WsOpenResultMessage, { ok: false }>;

/** A refusal for a local WS that never answered (502) or answered too late (504). */
export function unreachableRefusal(
	id: string,
	timedOut: boolean,
): WsOpenRefusal {
	return {
		type: "ws-open-result",
		id,
		ok: false,
		status: timedOut ? 504 : 502,
	};
}

/**
 * Turn the app's non-101 answer to the handshake into a `ws-open-result`.
 *
 * Returns the refusal at once (status and headers) so a deadline that hits
 * while the body is still arriving can send what it has; `onDone` fires when
 * the body ended, failed, or reached `WS_APP_REJECT_BODY_MAX` bytes. The
 * server re-checks every field: this is the client's best effort, not a
 * guarantee.
 */
export function readRefusal(
	id: string,
	res: http.IncomingMessage,
	onDone: (refusal: WsOpenRefusal) => void,
): WsOpenRefusal {
	const max = DEFAULTS.WS_APP_REJECT_BODY_MAX;
	const chunks: Buffer[] = [];
	let size = 0;
	const refusal: WsOpenRefusal = {
		type: "ws-open-result",
		id,
		ok: false,
		status: res.statusCode ?? 502,
		...(res.statusMessage ? { statusText: res.statusMessage } : {}),
		headers: stripHopByHopHeaders(
			res.headers as Record<string, string | string[]>,
		),
	};
	const finish = (): void => onDone(refusal);
	res.on("data", (chunk: Buffer) => {
		if (size >= max) return;
		const part = chunk.subarray(0, max - size);
		chunks.push(part);
		size += part.length;
		// Kept current, so a deadline mid-body still sends what arrived.
		refusal.body = Buffer.concat(chunks).toString("base64");
		if (size >= max) finish();
	});
	res.on("end", finish);
	res.on("error", finish);
	return refusal;
}
