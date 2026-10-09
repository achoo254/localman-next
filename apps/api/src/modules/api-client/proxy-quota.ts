import { OperationError } from "@localman/operations";
import { limitsFor } from "@localman/shared";
import { runtimeSettings } from "../../config/runtime-settings.js";
import { takeRateLimitSlot } from "../../lib/rate-limit-windows.js";
import { currentPlanOf } from "../billing/plan-guard.js";
import { incrementUsage } from "../billing/usage-counter-model.js";

function rateLimited(): OperationError {
	return new OperationError(
		429,
		"RATE_LIMITED",
		"Too many proxied requests; wait a minute and try again",
	);
}

function monthlyQuotaExceeded(max: number): OperationError {
	return new OperationError(
		429,
		"MONTHLY_QUOTA_EXCEEDED",
		`Your plan allows ${max} proxied requests a month; upgrade or wait for next month`,
		{ limit: "proxyRequests", max, used: max },
	);
}

/**
 * Admits one proxied request of `sub`: first the per-user rate window
 * (`proxyRateLimit`), then the monthly `proxyRequestsPerMonth` of the
 * user's effective plan (Asia/Saigon month, `null` = no cap). The month
 * counter is incremented atomically and given back when the request is
 * refused, so racing requests never pass the cap and the account page
 * never shows more than the cap. Every admitted request counts, whatever
 * the target answers (a timeout or a blocked target included).
 */
export async function admitProxyRequest(sub: string): Promise<void> {
	const window = runtimeSettings().proxyRateLimit;
	if (!(await takeRateLimitSlot("proxy:user", sub, window))) {
		throw rateLimited();
	}
	const max = limitsFor(await currentPlanOf(sub)).proxyRequestsPerMonth;
	// One instant for both writes, so a refusal at midnight on the last
	// day of a month gives the slot back to the month it took it from.
	const at = new Date();
	const used = await incrementUsage(sub, "proxyRequests", 1, at);
	if (max !== null && used > max) {
		await incrementUsage(sub, "proxyRequests", -1, at);
		throw monthlyQuotaExceeded(max);
	}
}
