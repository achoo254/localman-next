import { OperationError } from "@localman/operations";
import type { Response } from "express";

/**
 * Open live logs of the process, per account, so the per-account cap is
 * enforced and shutdown can end them all. Once closed, every stream that
 * finishes authenticating is refused (503 `SHUTTING_DOWN`): a stream
 * opening during shutdown would otherwise hold the HTTP server open.
 */
export class LogStreamRegistry {
	private readonly open = new Set<Response>();
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
	add(sub: string, res: Response): () => void {
		this.open.add(res);
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

	/** Shutdown: ends every open stream and refuses new ones. */
	close(): void {
		this.closed = true;
		for (const res of this.open) res.end();
	}
}

/** The process's live logs, closed by `main.ts` at shutdown. */
export const logStreams = new LogStreamRegistry();
