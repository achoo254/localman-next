import type { Duplex } from "node:stream";
import type { WebSocket } from "ws";

/** Bytes a browser may send before its `101` (it should send none). */
const MAX_EARLY_BYTES = 64 * 1024;

/** Completes the held upgrade (writes `101`), then hands over the socket. */
export type AcceptUpgrade = (
	head: Buffer,
	protocol: string | undefined,
	onOpen: (ws: WebSocket) => void,
) => void;

export interface HeldUpgrade {
	socket: Duplex;
	head: Buffer;
	subdomain: string;
	path: string;
	headers: Record<string, string | string[]>;
	protocol: string | undefined;
	accept: AcceptUpgrade;
	/** Wait for `ws-open-result` (ms). Overridden only by tests. */
	timeoutMs?: number;
}

export interface HeldSocket {
	/** What the browser sent early, to replay to `ws` as part of `head`. */
	early(): Buffer[];
	/** Stop reading, so `ws` gets every byte from here on. */
	stopReading(): void;
	/** Drop every listener added here. */
	release(): void;
}

/**
 * Watch an upgrade socket whose `101` is not written yet.
 *
 * Node hands the upgrade socket over unread, and an unread socket never
 * reports the peer's FIN: a browser that gave up would stay held until the
 * timeout. Reading it (and keeping the bytes) is what makes that visible.
 */
export function holdSocket(
	socket: Duplex,
	onGone: (reason: string) => void,
): HeldSocket {
	const chunks: Buffer[] = [];
	let bytes = 0;
	const onData = (chunk: Buffer): void => {
		chunks.push(chunk);
		bytes += chunk.length;
		if (bytes > MAX_EARLY_BYTES) onGone("Early data");
	};
	const onEnd = (): void => onGone("Browser left");
	socket.on("data", onData);
	socket.on("end", onEnd);
	socket.on("close", onEnd);
	socket.on("error", onEnd);
	return {
		early: () => chunks,
		stopReading: () => socket.off("data", onData),
		release: () => {
			socket.off("data", onData);
			socket.off("end", onEnd);
			socket.off("close", onEnd);
			socket.off("error", onEnd);
		},
	};
}

/** A write to a peer that reset must not surface as an unhandled "error". */
export function guardWrites(socket: Duplex): void {
	socket.on("error", () => undefined);
}
