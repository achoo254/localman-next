import { OperationError } from "@localman/operations";
import type { McpHttpHandler } from "@modelcontextprotocol/server";

/**
 * The live MCP HTTP handlers of the process (Localman MCP and the
 * per-request handlers of Hosted Mock MCP), closed together at shutdown:
 * `handler.close()` ends their open SSE streams (`subscriptions/listen`),
 * which would otherwise hold the HTTP servers open until the forced exit.
 */
export class McpHandlerRegistry {
	readonly #live = new Set<McpHttpHandler>();
	#closed = false;
	/** From `closeAll`: where closes of late handlers report failures. */
	#onCloseError: (error: unknown) => void = () => undefined;

	/** 503 once `closeAll` ran, so no new MCP stream opens during shutdown. */
	assertOpen(): void {
		if (this.#closed) {
			throw new OperationError(
				503,
				"SHUTTING_DOWN",
				"The server is shutting down, try again shortly",
			);
		}
	}

	/**
	 * Tracks `handler` until the returned function runs. A handler tracked
	 * after `closeAll` (a request that passed `assertOpen` just before) is
	 * closed at once, so no stream it opens outlives the shutdown.
	 */
	track(handler: McpHttpHandler): () => void {
		if (this.#closed) {
			handler.close().catch(this.#onCloseError);
			return () => undefined;
		}
		this.#live.add(handler);
		return () => {
			this.#live.delete(handler);
		};
	}

	/** Closes every tracked handler; a failing close does not stop the rest. */
	async closeAll(onError: (error: unknown) => void): Promise<void> {
		this.#closed = true;
		this.#onCloseError = onError;
		const handlers = [...this.#live];
		this.#live.clear();
		const results = await Promise.allSettled(handlers.map((h) => h.close()));
		for (const result of results) {
			if (result.status === "rejected") onError(result.reason);
		}
	}
}
