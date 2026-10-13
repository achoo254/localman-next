import type { OperationGuardContext } from "@localman/operations";
import { tenantSettings } from "../../tenancy/tenant-settings.js";

/** Whether the subject is one of the Localman owners (`OWNER_SUBS`). */
export function isOwnerSub(sub: string): boolean {
	return tenantSettings().ownerSubs.has(sub);
}

/**
 * `guard` of admin operations: only an owner passes; everyone else gets
 * 403 `FORBIDDEN` from the router before the input is even parsed.
 */
export function ownerOnly(ctx: OperationGuardContext): boolean {
	return ctx.auth !== null && isOwnerSub(ctx.auth.subjectId);
}
