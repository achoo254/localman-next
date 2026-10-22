import { OperationError } from "@localman/operations";
import { decodeJwt, decodeProtectedHeader } from "jose";
import { z } from "zod";
import type { Logger } from "../../logger.js";
import { currentTenant } from "../../tenancy/tenant-context.js";
import {
	recordAuditEvent,
	wasAuditEventReceived,
} from "./audit-event-model.js";
import type { AuditEvent } from "./security-event-token.js";

/** Event URIs of the IdP: `urn:hoandat:auth:event:` + type. */
const EVENT_URI_PREFIX = "urn:hoandat:auth:event:";
const CLOCK_TOLERANCE_SECONDS = 30;
/** Same window as a verified SET: signed for 10 minutes, at most 15. */
const MAX_AGE_SECONDS = 15 * 60;
const ISSUER = /^https:\/\/auth\.([a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?)$/;

/** Where the request that caused the event came from, as the IdP adds it. */
const origin = {
	ip: z.string().max(100).optional(),
	user_agent: z.string().max(1000).optional(),
};

/**
 * Events after which the IdP no longer serves the tenant (hoandat-auth
 * `src/audit/audit-events.ts`): moving to or running on its owner's
 * servers, suspended, released. Their data, exactly.
 */
const NOT_SERVED_EVENT_DATA = {
	"tenant.migrating": z.object({ domain: z.string(), ...origin }).strict(),
	"tenant.self_hosted": z.object({ domain: z.string(), ...origin }).strict(),
	"tenant.suspended": z
		.object({ reason: z.string().max(500), ...origin })
		.strict(),
	"tenant.released": z
		.object({ reason: z.string().max(500), ...origin })
		.strict(),
} as const;

type NotServedType = keyof typeof NOT_SERVED_EVENT_DATA;

const isNotServedType = (type: string): type is NotServedType =>
	Object.hasOwn(NOT_SERVED_EVENT_DATA, type);

const claims = z.object({
	iss: z.string(),
	aud: z.union([z.string(), z.array(z.string())]),
	sub: z.string().min(1).max(200),
	jti: z.string().min(1).max(200),
	iat: z.number(),
	exp: z.number(),
	toe: z.number().optional(),
	events: z.record(z.string(), z.unknown()),
});

/** A lifecycle event of a tenant this Localman does not serve. */
export interface TenantLifecycleEvent extends AuditEvent {
	/** The tenant's domain, from its issuer `https://auth.<domain>`. */
	readonly domain: string;
}

/**
 * Reads a SET about a tenant the IdP no longer serves, whose signature
 * Localman cannot check: the IdP publishes a tenant's keys only while it
 * serves it (`/internal/tenants/<id>/jwks` answers 404 once the tenant is
 * migrating, self-hosted, suspended or released), yet keeps sending that
 * tenant's events, signed with them, forever. Everything but the
 * signature is checked as for a verified SET (header, `aud`, `iat`/`exp`
 * window, `jti`, `sub`, one IdP event), and only these event types with
 * exactly their data are taken; the caller has already checked the IdP's
 * Basic credentials. `null`: not such an event (answer 400).
 */
export function readNotServedTenantEvent(
	token: string,
	options: {
		readonly audience: string;
		/** The deployment's own domain: its events are always verifiable. */
		readonly primaryDomain: string;
		readonly nowSeconds?: number;
	},
): TenantLifecycleEvent | null {
	let header: ReturnType<typeof decodeProtectedHeader>;
	let payload: unknown;
	try {
		header = decodeProtectedHeader(token);
		payload = decodeJwt(token);
	} catch {
		return null;
	}
	if (header.alg !== "ES256" || header.typ !== "secevent+jwt") return null;
	const parsed = claims.safeParse(payload);
	if (!parsed.success) return null;
	const { iss, aud, sub, jti, iat, exp, toe, events } = parsed.data;
	const domain = ISSUER.exec(iss)?.[1];
	if (!domain || domain === options.primaryDomain) return null;
	const audiences = Array.isArray(aud) ? aud : [aud];
	if (!audiences.includes(options.audience)) return null;
	const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
	if (
		iat > now + CLOCK_TOLERANCE_SECONDS ||
		now - iat > MAX_AGE_SECONDS ||
		exp < now - CLOCK_TOLERANCE_SECONDS ||
		exp - iat > MAX_AGE_SECONDS
	) {
		return null;
	}
	const entries = Object.entries(events);
	const [entry] = entries;
	if (entries.length !== 1 || !entry?.[0].startsWith(EVENT_URI_PREFIX)) {
		return null;
	}
	const type = entry[0].slice(EVENT_URI_PREFIX.length);
	if (!isNotServedType(type)) return null;
	const data = NOT_SERVED_EVENT_DATA[type].safeParse(entry[1]);
	if (!data.success) return null;
	if ("domain" in data.data && data.data.domain !== domain) return null;
	return {
		jti,
		sub,
		type,
		domain,
		occurredAt: new Date((toe ?? iat) * 1000),
		// The issuer records which tenant it was, and that it was unsigned.
		data: { ...data.data, issuer: iss, signature: "not-verifiable" },
	};
}

/**
 * The intake's answer for a SET whose issuer is not a tenant served here:
 * a lifecycle event (`readNotServedTenantEvent`) is recorded once per
 * `jti` in the intake's own tenant (the deployment operator's) and acted
 * on by nothing else: the IdP already stopped answering for the tenant, so
 * Localman stops serving it (ADR-0003 §7, §13); anything else is 400.
 */
export async function acceptNotServedTenantEvent(
	token: string,
	options: {
		readonly idempotencyKey: unknown;
		readonly audience: string;
		readonly logger: Logger;
	},
): Promise<"accepted" | "duplicate"> {
	const event = readNotServedTenantEvent(token, {
		audience: options.audience,
		primaryDomain: currentTenant().domain,
	});
	if (!event) {
		throw new OperationError(
			400,
			"INVALID_SECURITY_EVENT",
			"The security event token is invalid",
		);
	}
	if (
		options.idempotencyKey !== undefined &&
		options.idempotencyKey !== event.jti
	) {
		throw new OperationError(
			400,
			"INVALID_SECURITY_EVENT",
			"Idempotency-Key does not match the event jti",
		);
	}
	if (await wasAuditEventReceived(event.jti)) return "duplicate";
	if (!(await recordAuditEvent(event))) return "duplicate";
	options.logger.warn(
		{ type: event.type, domain: event.domain, jti: event.jti },
		"Tenant lifecycle event for a tenant no longer served here",
	);
	return "accepted";
}
