import { DEFAULTS, ErrorCode } from "@tunelo/shared";
import type { StreamMessage, TunnelResponse } from "@tunelo/shared";
import { createLogger } from "../logger.js";

const logger = createLogger("tunelo-stream-registry");

/**
 * Consumer of a relayed stream. The relay wires these to a Node HTTP response;
 * a future WebSocket relay can implement the same sink for its own transport.
 */
export interface StreamSink {
	onStart(status: number, headers: Record<string, string | string[]>): void;
	onData(chunk: Buffer): void;
	onEnd(): void;
	onError(err: Error): void;
}

interface PendingStream {
	sink: StreamSink;
	connectionId: string;
	idleTimer: ReturnType<typeof setTimeout>;
	started: boolean;
	done: boolean;
}

/**
 * Tracks in-flight streams keyed by id, direction-agnostic and independent of
 * tunnels so it can back both the current HTTP response relay and a later
 * WebSocket relay. Enforces an idle timeout (reset on every frame) rather than
 * a single hard deadline, so SSE / long-lived responses stay open.
 */
export class StreamRegistry {
	private streams = new Map<string, PendingStream>();

	/** Register a sink for `id`; starts the idle timer (covers time-to-first-byte). */
	register(id: string, connectionId: string, sink: StreamSink): void {
		const entry: PendingStream = {
			sink,
			connectionId,
			idleTimer: this.armIdle(id),
			started: false,
			done: false,
		};
		this.streams.set(id, entry);
	}

	/**
	 * Route a stream frame to its sink. Unknown ids are ignored (already
	 * closed), as are frames from a connection other than the stream's.
	 */
	push(connectionId: string, frame: StreamMessage): void {
		const entry = this.streams.get(frame.id);
		if (!entry || entry.done || entry.connectionId !== connectionId) return;
		this.resetIdle(frame.id, entry);

		switch (frame.type) {
			case "stream-start":
				// Ignore a duplicate start — a second writeHead would throw.
				if (entry.started) return;
				entry.started = true;
				entry.sink.onStart(frame.status, frame.headers);
				break;
			case "stream-data":
				// Ignore data before the response line/headers are set.
				if (!entry.started) return;
				entry.sink.onData(Buffer.from(frame.data, "base64"));
				break;
			case "stream-end":
				this.finish(frame.id, entry);
				entry.sink.onEnd();
				break;
			case "stream-error":
				this.finish(frame.id, entry);
				entry.sink.onError(new Error(frame.message));
				break;
			default:
				break;
		}
	}

	/** Adapt a legacy single-message response into the start → data → end lifecycle. */
	pushLegacyResponse(connectionId: string, response: TunnelResponse): void {
		const entry = this.streams.get(response.id);
		if (!entry || entry.done || entry.connectionId !== connectionId) return;
		this.finish(response.id, entry);
		entry.sink.onStart(response.status, response.headers);
		if (response.body) entry.sink.onData(Buffer.from(response.body, "base64"));
		entry.sink.onEnd();
	}

	/** Fail every stream owned by a connection that just dropped. */
	cleanupByConnection(connectionId: string): void {
		for (const [id, entry] of this.streams) {
			if (entry.connectionId !== connectionId) continue;
			this.finish(id, entry);
			entry.sink.onError(
				new Error(`Tunnel disconnected [${ErrorCode.TUNNEL_NOT_FOUND}]`),
			);
		}
	}

	has(id: string): boolean {
		return this.streams.has(id);
	}

	/** Drop a stream without invoking its sink (consumer already gone). */
	drop(id: string): void {
		const entry = this.streams.get(id);
		if (entry) this.finish(id, entry);
	}

	private finish(id: string, entry: PendingStream): void {
		entry.done = true;
		clearTimeout(entry.idleTimer);
		this.streams.delete(id);
	}

	private resetIdle(id: string, entry: PendingStream): void {
		clearTimeout(entry.idleTimer);
		entry.idleTimer = this.armIdle(id);
	}

	private armIdle(id: string): ReturnType<typeof setTimeout> {
		return setTimeout(() => {
			const entry = this.streams.get(id);
			if (!entry || entry.done) return;
			this.finish(id, entry);
			logger.warn({ id }, "Stream idle timeout");
			entry.sink.onError(
				new Error(`Stream timeout [${ErrorCode.REQUEST_TIMEOUT}]`),
			);
		}, DEFAULTS.STREAM_IDLE_TIMEOUT_MS);
	}
}
