import { AsyncLocalStorage } from "node:async_hooks";

/** How an operation was reached when it is not the web app: Localman MCP. */
export type CallChannel = "mcp";

const channel = new AsyncLocalStorage<CallChannel>();

/**
 * Runs `fn` as reached through `which`, for what records the channel of a
 * change (the collection changelog shows "via MCP") without every service
 * taking the operation context.
 */
export function runInChannel<T>(which: CallChannel, fn: () => T): T {
	return channel.run(which, fn);
}

/** The channel of the running call; `null` for the web app. */
export function currentChannel(): CallChannel | null {
	return channel.getStore() ?? null;
}
