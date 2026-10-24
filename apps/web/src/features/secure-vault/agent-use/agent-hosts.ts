/**
 * The hosts a secret may be filled into for agents (ADR-0009), as typed in
 * the dialog: one per line, checked with the server's own schema so the
 * dialog refuses what the server would. Pure, so the dialog and its tests
 * read the same rules. The server alone knows every host of the product
 * (mock, tunnel, other tenants); here only the app's own host is caught.
 */
import { AGENT_HOSTS_MAX, agentHostSchema } from "@localman/shared/api-client";

export type HostProblem =
	| { kind: "scheme" }
	| { kind: "format" }
	| { kind: "open" }
	| { kind: "app" }
	| { kind: "duplicate"; line: number };

export interface HostLineError {
	/** 1-based line of the textarea. */
	line: number;
	host: string;
	problem: HostProblem;
}

export interface ParsedHosts {
	hosts: string[];
	errors: HostLineError[];
	/** More than `AGENT_HOSTS_MAX` lines with a host. */
	tooMany: boolean;
}

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//;
/** A port, path, query, fragment or credentials pasted with the host. */
const NOT_A_HOST = /[/:?#@]/;

const under = (host: string, domain: string): boolean =>
	domain !== "" && (host === domain || host.endsWith(`.${domain}`));

/** Whether `pattern` names or covers the host this app runs on. */
export function isAppHost(pattern: string, appHost: string): boolean {
	const app = appHost.toLowerCase();
	if (!pattern.startsWith("*.")) return under(pattern, app);
	const base = pattern.slice(2);
	return under(base, app) || app.endsWith(`.${base}`);
}

function problemOf(host: string, appHost: string): HostProblem | null {
	if (SCHEME.test(host) || NOT_A_HOST.test(host)) return { kind: "scheme" };
	const parsed = agentHostSchema.safeParse(host);
	if (!parsed.success) {
		// The schema's refine (code "custom") is the open-wildcard rule.
		const open = parsed.error.issues.every((issue) => issue.code === "custom");
		return { kind: open ? "open" : "format" };
	}
	return isAppHost(host, appHost) ? { kind: "app" } : null;
}

/** One host per line; blank lines are ignored. */
export function parseAgentHosts(text: string, appHost: string): ParsedHosts {
	const hosts: string[] = [];
	const errors: HostLineError[] = [];
	const seen = new Map<string, number>();
	let filled = 0;
	text.split("\n").forEach((raw, index) => {
		const host = raw.trim().toLowerCase();
		if (host === "") return;
		filled += 1;
		const line = index + 1;
		const first = seen.get(host);
		const problem: HostProblem | null =
			first === undefined
				? problemOf(host, appHost)
				: { kind: "duplicate", line: first };
		if (problem) {
			errors.push({ line, host, problem });
			return;
		}
		seen.set(host, line);
		hosts.push(host);
	});
	return { hosts, errors, tooMany: filled > AGENT_HOSTS_MAX };
}

/** Whether the parsed list can be saved. */
export const hostsSavable = (parsed: ParsedHosts): boolean =>
	parsed.hosts.length > 0 && parsed.errors.length === 0 && !parsed.tooMany;

/** "api.example.com +2" for the chip in the table. */
export function agentHostsLabel(hosts: readonly string[]): string {
	const [first = ""] = hosts;
	return hosts.length > 1 ? `${first} +${hosts.length - 1}` : first;
}

/**
 * Hosts named by the server in a 400 `AGENT_HOST_NOT_ALLOWED`
 * (`details.hosts`: "a.test, b.test").
 */
export function refusedHosts(details: unknown): string[] {
	if (typeof details !== "object" || details === null) return [];
	const hosts: unknown = Reflect.get(details, "hosts");
	if (typeof hosts !== "string") return [];
	return hosts
		.split(",")
		.map((host) => host.trim().toLowerCase())
		.filter((host) => host !== "");
}

/** Lines holding a host the server refused, as errors of those lines. */
export function refusedLines(
	text: string,
	refused: readonly string[],
): HostLineError[] {
	return text.split("\n").flatMap((raw, index): HostLineError[] => {
		const host = raw.trim().toLowerCase();
		return refused.includes(host)
			? [{ line: index + 1, host, problem: { kind: "app" } }]
			: [];
	});
}

/** A variable whose name reads like a base URL or host. */
const URL_LIKE = /base|url|host|origin|endpoint/i;

export interface SuggestionSource {
	key: string;
	/** Values to read a host from (shared, local); others are skipped. */
	values: readonly (string | null | undefined)[];
}

function hostOfValue(value: string | null | undefined): string | null {
	if (!value || value.includes("{{")) return null;
	try {
		const { protocol, hostname } = new URL(value.trim());
		if (protocol !== "http:" && protocol !== "https:") return null;
		return hostname.toLowerCase();
	} catch {
		return null;
	}
}

function hostsOf(sources: readonly SuggestionSource[], appHost: string) {
	return sources
		.filter((source) => URL_LIKE.test(source.key))
		.flatMap((source) => source.values.map(hostOfValue))
		.filter(
			(host): host is string =>
				host !== null && problemOf(host, appHost) === null,
		);
}

export interface HostSuggestions {
	/** First host of the variable's own scope: the dialog starts with it. */
	prefill: string | null;
	/** Own scope first, then the others, without repeats. */
	all: string[];
}

/** Hosts from base-URL variables, to add with one click. */
export function hostSuggestions(
	own: readonly SuggestionSource[],
	others: readonly SuggestionSource[],
	appHost: string,
): HostSuggestions {
	const first = hostsOf(own, appHost);
	return {
		prefill: first[0] ?? null,
		all: [...new Set([...first, ...hostsOf(others, appHost)])],
	};
}
