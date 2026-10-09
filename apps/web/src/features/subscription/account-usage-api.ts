import type { PlanId } from "@localman/shared";
import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";

/** `max: null` means no monthly cap (only per-second rate limits). */
export interface UsageCounter {
	used: number;
	max: number | null;
}

export interface AccountUsage {
	plan: PlanId;
	planExpiresAt: string | null;
	/** `YYYY-MM` the monthly counters belong to. */
	period: string;
	projects: UsageCounter;
	mockRequests: UsageCounter;
	proxyRequests: UsageCounter;
}

function parseCounter(data: JsonRecord, key: string): UsageCounter {
	const counter = expectRecord(data[key], key);
	const max = counter.max;
	if (max !== null && (typeof max !== "number" || !Number.isFinite(max))) {
		throw new InvalidResponseError(`${key}.max`);
	}
	return { used: expectNumber(counter, "used"), max };
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
	};
}

export async function fetchAccountUsage(): Promise<AccountUsage> {
	return parseAccountUsage(await apiRequest("/api/v1/account/usage"));
}
