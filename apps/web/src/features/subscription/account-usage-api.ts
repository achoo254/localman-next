import type { PlanId } from "@localman/shared/constants";
import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
	expectNumber,
	expectRecord,
	expectString,
	isRecord,
	optionalString,
} from "../../lib/json-guards";

/** `max: null` means no monthly cap (only per-second rate limits). */
export interface UsageCounter {
	used: number;
	max: number | null;
}

/** A quota the account is above, e.g. after a Pro trial ended. */
export interface OverLimit {
	limit: "projects" | "resources";
	used: number;
	max: number;
}

export interface AccountUsage {
	plan: PlanId;
	planExpiresAt: string | null;
	/** `YYYY-MM` the monthly counters belong to. */
	period: string;
	projects: UsageCounter;
	mockRequests: UsageCounter;
	proxyRequests: UsageCounter;
	/** Empty when within every limit (and from an API that does not send it). */
	overLimits: OverLimit[];
}

function parseCounter(data: JsonRecord, key: string): UsageCounter {
	const counter = expectRecord(data[key], key);
	const max = counter.max;
	if (max !== null && (typeof max !== "number" || !Number.isFinite(max))) {
		throw new InvalidResponseError(`${key}.max`);
	}
	return { used: expectNumber(counter, "used"), max };
}

function parseOverLimit(value: unknown): OverLimit | null {
	if (!isRecord(value)) return null;
	const { limit, used, max } = value;
	if (limit !== "projects" && limit !== "resources") return null;
	if (typeof used !== "number" || typeof max !== "number") return null;
	return { limit, used, max };
}

/** Tolerant: an unknown entry is skipped rather than failing the meters. */
function parseOverLimits(value: unknown): OverLimit[] {
	if (!Array.isArray(value)) return [];
	return value
		.map(parseOverLimit)
		.filter((entry): entry is OverLimit => entry !== null);
}

export function parseAccountUsage(value: unknown): AccountUsage {
	const data = expectRecord(value, "account usage");
	const plan = expectString(data, "plan");
	if (plan !== "free" && plan !== "pro") {
		throw new InvalidResponseError(`plan "${plan}"`);
	}
	return {
		plan,
		planExpiresAt: optionalString(data, "planExpiresAt"),
		period: expectString(data, "period"),
		projects: parseCounter(data, "projects"),
		mockRequests: parseCounter(data, "mockRequests"),
		proxyRequests: parseCounter(data, "proxyRequests"),
		overLimits: parseOverLimits(data.overLimits),
	};
}

export async function fetchAccountUsage(): Promise<AccountUsage> {
	return parseAccountUsage(await apiRequest("/api/v1/account/usage"));
}
