import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
	expectArray,
	expectBoolean,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";

/**
 * Where a hybrid mock forwards the routes it does not answer: nowhere,
 * the owner's tunnel of `localhost:<port>`, or an https base URL.
 */
export type ProjectUpstream =
	| { kind: "none" }
	| { kind: "tunnel"; port: number }
	| { kind: "url"; baseUrl: string };

export type TrafficPlan = "free" | "pro";

/** `GET /projects/:projectId/traffic-settings`. */
export interface TrafficSettings {
	upstream: ProjectUpstream;
	/** The owner's tunnel URL of the upstream port; null when unmapped. */
	tunnelUrl: string | null;
	/** Extra header names masked in the request log. */
	redactHeaders: string[];
	/** Header names always masked. */
	defaultRedactedHeaders: string[];
	plan: TrafficPlan;
	/** Days a log line written now is kept. */
	logDays: number;
	/** The caller may change these settings (owner only today). */
	canManage: boolean;
}

export const trafficSettingsKey = (projectId: string) =>
	["traffic-settings", projectId] as const;

const projectPath = (projectId: string) =>
	`/api/v1/projects/${encodeURIComponent(projectId)}`;

function parseUpstream(value: unknown): ProjectUpstream {
	const data = expectRecord(value, "upstream");
	const kind = expectString(data, "kind");
	if (kind === "none") return { kind };
	if (kind === "tunnel") return { kind, port: expectNumber(data, "port") };
	if (kind === "url") return { kind, baseUrl: expectString(data, "baseUrl") };
	throw new InvalidResponseError(`upstream kind "${kind}"`);
}

function stringList(data: JsonRecord, key: string): string[] {
	return expectArray(data, key).map((item) => {
		if (typeof item !== "string") throw new InvalidResponseError(key);
		return item;
	});
}

export function parseTrafficSettings(value: unknown): TrafficSettings {
	const data = expectRecord(value, "traffic settings");
	const plan = expectString(data, "plan");
	if (plan !== "free" && plan !== "pro") {
		throw new InvalidResponseError(`plan "${plan}"`);
	}
	return {
		upstream: parseUpstream(data.upstream),
		tunnelUrl: optionalString(data, "tunnelUrl"),
		redactHeaders: stringList(data, "redactHeaders"),
		defaultRedactedHeaders: stringList(data, "defaultRedactedHeaders"),
		plan,
		logDays: expectNumber(data, "logDays"),
		canManage: expectBoolean(data, "canManage"),
	};
}

export async function fetchTrafficSettings(
	projectId: string,
): Promise<TrafficSettings> {
	return parseTrafficSettings(
		await apiRequest(`${projectPath(projectId)}/traffic-settings`),
	);
}

/** Owner only; a URL goes through the server's private-network check. */
export async function saveUpstream(
	projectId: string,
	upstream: ProjectUpstream,
): Promise<TrafficSettings> {
	return parseTrafficSettings(
		await apiRequest(`${projectPath(projectId)}/upstream`, {
			method: "PUT",
			body: { upstream },
		}),
	);
}

/** Owner only; replaces the extra masked header names. */
export async function saveRedactHeaders(
	projectId: string,
	headers: readonly string[],
): Promise<TrafficSettings> {
	return parseTrafficSettings(
		await apiRequest(`${projectPath(projectId)}/redact-headers`, {
			method: "PUT",
			body: { headers },
		}),
	);
}

/** `none`, `tunnel:3000` or the base URL, as the settings show it. */
export function upstreamLabel(upstream: ProjectUpstream): string {
	if (upstream.kind === "tunnel") return `tunnel:${upstream.port}`;
	if (upstream.kind === "url") return upstream.baseUrl;
	return "none";
}
