import { OperationError } from "@localman/operations";
import express, { type RequestHandler, type Router } from "express";
import { decodeJwt } from "jose";
import { asyncHandler } from "../../http/async-handler.js";
import {
	DEFAULT_SERVER_LIMIT_PER_MINUTE,
	ipRateLimit,
} from "../../http/ip-rate-limit.js";
import { noStore } from "../../http/no-store.js";
import type { Logger } from "../../logger.js";
import { INTERNAL_PATHS } from "../../operations/protocol-routes.js";
import {
	type LocalmanTenant,
	currentTenant,
	runInTenant,
} from "../../tenancy/tenant-context.js";
import { tenantOfIssuer } from "../../tenancy/tenant-of-issuer.js";
import type { OidcApi } from "../auth/oidc-api.js";
import {
	IdpUnavailableError,
	authUnavailableError,
} from "../auth/oidc-errors.js";
import { applyAuditEvent } from "./audit-event-handlers.js";
import {
	recordAuditEvent,
	wasAuditEventReceived,
} from "./audit-event-model.js";
import {
	type BasicCredentials,
	hasValidBasicCredentials,
} from "./basic-credentials.js";
import {
	type AuditEvent,
	InvalidSecurityEventError,
	SET_MEDIA_TYPE,
	verifySecurityEvent,
} from "./security-event-token.js";

/** A SET is well under a kilobyte; anything bigger is not one. */
const BODY_LIMIT = "32kb";

export interface AuditEventsRouteOptions {
	readonly oidc: OidcApi;
	readonly credentials: BasicCredentials;
	/** The absolute URL of this endpoint: the SET's expected `aud`. */
	readonly audience: string;
	readonly logger: Logger;
	/** Calls per client IP and minute (default `DEFAULT_SERVER_LIMIT_PER_MINUTE`). */
	readonly limitPerMinute?: number;
}

function invalidEvent(message: string): OperationError {
	return new OperationError(400, "INVALID_SECURITY_EVENT", message);
}

/** Basic credentials are checked before the body is even read. */
function requireIdpCredentials(credentials: BasicCredentials): RequestHandler {
	return (req, res, next) => {
		if (hasValidBasicCredentials(req.headers.authorization, credentials)) {
			next();
			return;
		}
		res.set("WWW-Authenticate", 'Basic realm="audit-events"');
		next(
			new OperationError(401, "UNAUTHENTICATED", "Invalid client credentials"),
		);
	};
}

/** `iss` of a SET before verification (empty when it cannot be read). */
function unverifiedIssuer(token: string): string {
	try {
		const { iss } = decodeJwt(token.trim());
		return typeof iss === "string" ? iss : "";
	} catch {
		return "";
	}
}

/**
 * The tenant of a SET's issuer: one whose `https://auth.<domain>` it is,
 * else the intake's own tenant when its IdP discovered that issuer.
 */
async function tenantOfSet(
	issuer: string,
	oidc: OidcApi,
): Promise<LocalmanTenant | undefined> {
	const named = await tenantOfIssuer(issuer);
	if (named) return named;
	try {
		return issuer === (await oidc.issuer()) ? currentTenant() : undefined;
	} catch (error) {
		if (error instanceof IdpUnavailableError) throw authUnavailableError();
		throw error;
	}
}

/** The SET checked against the current tenant's IdP. */
async function verified(
	token: string,
	oidc: OidcApi,
	options: AuditEventsRouteOptions,
	logger: Logger,
): Promise<AuditEvent> {
	try {
		return await verifySecurityEvent(token, {
			jwks: await oidc.jwks(),
			issuer: await oidc.issuer(),
			audience: options.audience,
		});
	} catch (error) {
		if (error instanceof InvalidSecurityEventError) {
			logger.info({ reason: error.message }, "Rejected an audit event");
			throw invalidEvent("The security event token is invalid");
		}
		if (error instanceof IdpUnavailableError) throw authUnavailableError();
		throw error;
	}
}

/**
 * `POST /internal/audit-events`: the IdP pushes credential events as
 * signed SETs (integration guide, section 10). Authenticated by HTTP Basic
 * and the IdP's signature, so exempt from the CSRF origin check. Answers
 * 202 once stored; a redelivered `jti` is acknowledged without being
 * applied again. Every tenant's events come here (the IdP has one
 * intake); each is verified and applied in the tenant of its `iss`. Mounted only when AUDIT_CLIENT_ID/SECRET are configured.
 */
export function registerAuditEventsRoute(
	router: Router,
	options: AuditEventsRouteOptions,
): void {
	const { oidc, logger } = options;
	router.post(
		INTERNAL_PATHS.auditEvents,
		noStore,
		ipRateLimit(options.limitPerMinute ?? DEFAULT_SERVER_LIMIT_PER_MINUTE),
		requireIdpCredentials(options.credentials),
		express.text({ type: SET_MEDIA_TYPE, limit: BODY_LIMIT }),
		asyncHandler(async (req, res) => {
			if (!req.is(SET_MEDIA_TYPE)) {
				throw new OperationError(
					415,
					"UNSUPPORTED_MEDIA_TYPE",
					`Body must be ${SET_MEDIA_TYPE}`,
				);
			}
			const token: unknown = req.body;
			if (typeof token !== "string" || token.trim() === "") {
				throw invalidEvent("Missing security event token");
			}
			// One intake for every tenant: the SET's issuer names the tenant,
			// whose keys and data the event is then handled with.
			const tenant = await tenantOfSet(unverifiedIssuer(token), oidc);
			if (!tenant) throw invalidEvent("The security event token is invalid");
			const status = await runInTenant(tenant, async () => {
				const event = await verified(token.trim(), oidc, options, logger);
				const idempotencyKey = req.headers["idempotency-key"];
				if (idempotencyKey !== undefined && idempotencyKey !== event.jti) {
					throw invalidEvent("Idempotency-Key does not match the event jti");
				}
				if (await wasAuditEventReceived(event.jti)) return "duplicate";
				await applyAuditEvent(event, logger);
				await recordAuditEvent(event);
				return "accepted";
			});
			res.status(202).json({ status });
		}),
	);
}
