/**
 * Locking or resetting the vault in one tab reaches the other tabs of this
 * browser (`BroadcastChannel`, where it exists), so none keeps showing or
 * using plaintext the person meant to lock away. A channel never delivers
 * to its own sender.
 */
export type VaultBroadcast = "lock" | "reset";

const NAME = "localman-vault";
let channel: BroadcastChannel | null | undefined;

function channelOf(): BroadcastChannel | null {
	if (channel !== undefined) return channel;
	channel =
		typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(NAME);
	// Node (tests) keeps the process alive for an open channel; browsers
	// have no such method.
	const unref: unknown = channel ? Reflect.get(channel, "unref") : undefined;
	if (channel && typeof unref === "function") unref.call(channel);
	return channel;
}

export function announceVault(event: VaultBroadcast): void {
	channelOf()?.postMessage(event);
}

/** Installs the one handler of this tab (the vault session). */
export function listenToVault(handler: (event: VaultBroadcast) => void): void {
	const current = channelOf();
	if (!current) return;
	current.onmessage = (message: MessageEvent<unknown>) => {
		if (message.data === "lock" || message.data === "reset") {
			handler(message.data);
		}
	};
}
