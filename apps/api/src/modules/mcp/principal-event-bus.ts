import { AsyncLocalStorage } from "node:async_hooks";
import type { ServerEvent, ServerEventBus } from "@modelcontextprotocol/server";

type Listener = (event: ServerEvent) => void;

/**
 * Change-event bus of Localman MCP whose `subscriptions/listen` streams
 * belong to a principal (user and OAuth client), so `enable_toolset` of
 * one agent notifies that agent's streams only, never another user's.
 * The SDK opens a stream while serving its request: `runAs` serves it
 * with the principal in async context, and `subscribe` reads it there.
 * A stream opened outside `runAs` gets no targeted events.
 */
export class PrincipalEventBus implements ServerEventBus {
	readonly #principal = new AsyncLocalStorage<string>();
	readonly #listeners = new Map<Listener, string | null>();

	constructor(private readonly onerror: (error: unknown) => void) {}

	/** Runs `serve` (one MCP exchange) on behalf of `principal`. */
	runAs<T>(principal: string, serve: () => T): T {
		return this.#principal.run(principal, serve);
	}

	subscribe(listener: Listener): () => void {
		this.#listeners.set(listener, this.#principal.getStore() ?? null);
		return () => {
			this.#listeners.delete(listener);
		};
	}

	/** Every open stream (the SDK's `notify` sugar); Localman uses `publishTo`. */
	publish(event: ServerEvent): void {
		this.#deliver(event, () => true);
	}

	/** The open streams of `principal` only. */
	publishTo(principal: string, event: ServerEvent): void {
		this.#deliver(event, (owner) => owner === principal);
	}

	#deliver(event: ServerEvent, accepts: (owner: string | null) => boolean) {
		for (const [listener, owner] of [...this.#listeners]) {
			if (!accepts(owner)) continue;
			try {
				listener(event);
			} catch (error) {
				// One broken stream must not stop delivery to the others.
				this.onerror(error);
			}
		}
	}
}
