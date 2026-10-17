/**
 * Which of the user's Tunelo tunnels a local address goes through when no
 * manual mapping is on: pure, so every rule is unit tested. The tunnel
 * last used for an address is remembered in this browser, so a choice
 * among several is asked once and a tunnel that stopped is told apart
 * from one never opened.
 */
import type { LocalTunnel } from "./tunelo-accounts-api";

export type AutoTunnelDecision =
	| { kind: "use"; tunnel: LocalTunnel }
	/** Several HTTP tunnels and none remembered: the user picks one. */
	| { kind: "choose"; tunnels: LocalTunnel[] }
	/** Only TCP tunnels for the port: the API client sends HTTP only. */
	| { kind: "tcpOnly" }
	/** No tunnel; `stopped` when one was used for this address before. */
	| { kind: "none"; stopped: boolean };

export function decideAutoTunnel(
	tunnels: readonly LocalTunnel[],
	remembered: string | null,
): AutoTunnelDecision {
	const http = tunnels.filter((tunnel) => tunnel.protocol === "http");
	const kept = http.find((tunnel) => tunnel.url === remembered);
	if (kept) return { kind: "use", tunnel: kept };
	const [only] = http;
	if (only && http.length === 1) return { kind: "use", tunnel: only };
	if (http.length > 1) return { kind: "choose", tunnels: http };
	if (tunnels.length > 0) return { kind: "tcpOnly" };
	return { kind: "none", stopped: remembered !== null };
}

/** Tunnel last used per local key (`localhost:3000` → tunnel origin). */
export interface TunnelChoices {
	get(key: string): string | null;
	set(key: string, url: string): void;
}

const STORAGE_KEY = "localman.apiClient.tunnelChoices";
/** Fired on `window` when a choice is stored (the URL bar's badge follows). */
export const TUNNEL_CHOICE_EVENT = "localman:tunnel-choice";
const MAX_CHOICES = 50;

function readAll(storage: Storage): Record<string, string> {
	const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}");
	if (typeof parsed !== "object" || parsed === null) return {};
	const entries = Object.entries(parsed).filter(
		(entry): entry is [string, string] => typeof entry[1] === "string",
	);
	return Object.fromEntries(entries);
}

/**
 * Choices in `localStorage`. Storage may be off (private mode, quota,
 * blocked): reads then find nothing and writes are dropped, so the user
 * is only asked again.
 */
export function browserTunnelChoices(
	storage: () => Storage = () => window.localStorage,
): TunnelChoices {
	return {
		get: (key) => {
			try {
				return readAll(storage())[key] ?? null;
			} catch {
				return null;
			}
		},
		set: (key, url) => {
			try {
				const all = readAll(storage());
				delete all[key];
				const kept = Object.entries(all).slice(-(MAX_CHOICES - 1));
				const next = Object.fromEntries([...kept, [key, url]]);
				storage().setItem(STORAGE_KEY, JSON.stringify(next));
				window.dispatchEvent(new Event(TUNNEL_CHOICE_EVENT));
			} catch {
				// Not remembered: the user is asked again next time.
			}
		},
	};
}
