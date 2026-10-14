import { OperationError } from "@localman/operations";
import type { RateLimitWindow } from "../../config/runtime-settings.js";
import { runtimeSettings } from "../../config/runtime-settings.js";
import {
	clientIpBucket,
	takeRateLimitSlot,
} from "../../lib/rate-limit-windows.js";

function rateLimited(): OperationError {
	return new OperationError(
		429,
		"RATE_LIMITED",
		"Too many requests; try again later",
	);
}

async function take(
	scope: string,
	key: string,
	window: RateLimitWindow,
): Promise<void> {
	if (!(await takeRateLimitSlot(scope, key, window))) throw rateLimited();
}

/** Counts a public lookup of `scope` per client IP; runs before any lookup. */
export function takeIpSlot(
	scope: "publicLink" | "accessKey",
	clientIp: string | null,
): Promise<void> {
	const limits = runtimeSettings().publicSharingRateLimit;
	const window =
		scope === "publicLink" ? limits.publicLinkPerIp : limits.accessKeyPerIp;
	return take(`publicSharing:${scope}:ip`, clientIpBucket(clientIp), window);
}

/** Counts a signed-in page (guest view, Run button) per account and IP. */
export async function takeSignedInSlot(
	scope: "guest" | "runButton",
	sub: string,
	clientIp: string | null,
): Promise<void> {
	const limits = runtimeSettings().publicSharingRateLimit;
	await take(
		`publicSharing:${scope}:ip`,
		clientIpBucket(clientIp),
		limits.publicLinkPerIp,
	);
	await take(`publicSharing:${scope}:user`, sub, limits.signedInPerUser);
}

/** Counts a use of an access key that matched (its id, not the key). */
export function takeAccessKeySlot(keyId: string): Promise<void> {
	return take(
		"publicSharing:accessKey:key",
		keyId,
		runtimeSettings().publicSharingRateLimit.accessKeyPerKey,
	);
}
