import { OperationError } from "@localman/operations";
import express, { type RequestHandler, type Router } from "express";
import { asyncHandler } from "../../http/async-handler.js";
import { noStore } from "../../http/no-store.js";
import type { Logger } from "../../logger.js";
import { INTERNAL_PATHS } from "../../operations/protocol-routes.js";
import type { OidcClient } from "../auth/oidc-client.js";
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
	readonly oidc: OidcClient;
	readonly credentials: BasicCredentials;
	/** The absolute URL of this endpoint: the SET's expected `aud`. */
	readonly audience: string;
	readonly logger: Logger;
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

/**
 * `POST /internal/audit-events`: the IdP pushes credential events as
 * signed SETs (integration guide, section 10). Authenticated by HTTP Basic
 * and the IdP's signature, so exempt from the CSRF origin check. Answers
 * 202 once stored; a redelivered `jti` is acknowledged without being
 * applied again. Mounted only when AUDIT_CLIENT_ID/SECRET are configured.
 */
export function registerAuditEventsRoute(
	router: Router,
	options: AuditEventsRouteOptions,
): void {
	const { oidc, logger } = options;
	router.post(
		INTERNAL_PATHS.auditEvents,
		noStore,
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
			let event: AuditEvent;
			try {
				event = await verifySecurityEvent(token.trim(), {
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
			const idempotencyKey = req.headers["idempotency-key"];
			if (idempotencyKey !== undefined && idempotencyKey !== event.jti) {
				throw invalidEvent("Idempotency-Key does not match the event jti");
			}
			if (await wasAuditEventReceived(event.jti)) {
				res.status(202).json({ status: "duplicate" });
				return;
			}
			await applyAuditEvent(event, logger);
			await recordAuditEvent(event);
			res.status(202).json({ status: "accepted" });
		}),
	);
}
