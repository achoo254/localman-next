import { OperationError } from "@localman/operations";
import type { Response } from "express";

/**
 * Open live logs of the process, per account, so the per-account cap is
 * enforced and shutdown can end them all. Once closed, every stream that
 * finishes authenticating is refused (503 `SHUTTING_DOWN`): a stream
 * opening during shutdown would otherwise hold the HTTP server open.
 */
export class LogStreamRegistry {
	/** Each open stream and the session it was opened with, if any. */
	private readonly open = new Map<Response, string | undefined>();
	private readonly perUser = new Map<string, number>();
	private closed = false;

	/** 503 once `close` ran. */
	assertOpen(): void {
		if (this.closed) {
			throw new OperationError(
				503,
				"SHUTTING_DOWN",
				"The server is shutting down, try again shortly",
			);
		}
	}

	/** Streams `sub` has open now. */
	countOf(sub: string): number {
		return this.perUser.get(sub) ?? 0;
	}

	/** Takes a slot of `sub` for `res`; the returned function gives it back once. */
	add(sub: string, res: Response, sessionId?: string): () => void {
		this.open.set(res, sessionId);
		this.perUser.set(sub, this.countOf(sub) + 1);
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.open.delete(res);
			const left = this.countOf(sub) - 1;
			if (left > 0) this.perUser.set(sub, left);
			else this.perUser.delete(sub);
		};
	}

	/** Open streams (tests). */
	get size(): number {
		return this.open.size;
	}

	/** Sign-out: ends the streams of these sessions (this process's). */
	endSessions(sessionIds: readonly string[]): void {
		const ended = new Set(sessionIds);
		for (const [res, sessionId] of this.open) {
			if (sessionId !== undefined && ended.has(sessionId)) res.end();
		}
	}

	/** Shutdown: ends every open stream and refuses new ones. */
	close(): void {
		this.closed = true;
		for (const res of this.open.keys()) res.end();
	}
}

/** The process's live logs, closed by `main.ts` at shutdown. */
export const logStreams = new LogStreamRegistry();
