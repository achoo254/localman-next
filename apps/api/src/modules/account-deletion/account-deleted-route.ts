import { OperationError } from "@localman/operations";
import express, { type Router } from "express";
import type { Types } from "mongoose";
import { asyncHandler } from "../../http/async-handler.js";
import {
	DEFAULT_SERVER_LIMIT_PER_MINUTE,
	ipRateLimit,
} from "../../http/ip-rate-limit.js";
import { noStore } from "../../http/no-store.js";
import type { Logger } from "../../logger.js";
import { INTERNAL_PATHS } from "../../operations/protocol-routes.js";
import {
	type AuditEvent,
	InvalidSecurityEventError,
	SET_MEDIA_TYPE,
	verifySecurityEvent,
} from "../audit/security-event-token.js";
import type { OidcApi } from "../auth/oidc-api.js";
import {
	IdpUnavailableError,
	authUnavailableError,
} from "../auth/oidc-errors.js";
import { UserModel } from "../users/user-model.js";
import { deleteAccount } from "./account-deletion-service.js";

/** Event type of `urn:hoandat:auth:event:account.deleted`. */
export const ACCOUNT_DELETED_EVENT = "account.deleted";

/** A SET is well under a kilobyte; anything bigger is not one. */
const BODY_LIMIT = "32kb";

export interface AccountDeletedRouteOptions {
	readonly oidc: OidcApi;
	/** The absolute URL of this endpoint: the SET's exact `aud`. */
	readonly audience: string;
	readonly logger: Logger;
	/** Calls per client IP and minute (default `DEFAULT_SERVER_LIMIT_PER_MINUTE`). */
	readonly limitPerMinute?: number;
}

function notASet(message: string): OperationError {
	return new OperationError(400, "INVALID_SECURITY_EVENT", message);
}

/**
 * The SET checked against the IdP's issuer and keys: a bad signature,
 * issuer, audience, type or lifetime answers 401 (the IdP retries once its
 * configuration is fixed), a body that is no SET 400.
 */
async function verified(
	token: string,
	options: AccountDeletedRouteOptions,
): Promise<AuditEvent> {
	try {
		return await verifySecurityEvent(token, {
			jwks: await options.oidc.jwks(),
			issuer: await options.oidc.issuer(),
			audience: options.audience,
		});
	} catch (error) {
		if (error instanceof InvalidSecurityEventError) {
			options.logger.info(
				{ reason: error.message },
				"Rejected an account deletion event",
			);
			if (!error.untrusted) throw notASet("Not a security event token");
			throw new OperationError(
				401,
				"UNAUTHENTICATED",
				"The security event token is not valid for this endpoint",
			);
		}
		if (error instanceof IdpUnavailableError) throw authUnavailableError();
		throw error;
	}
}

/**
 * `POST /internal/account-deleted`: the IdP tells every app that an
 * account was deleted (auth-next ADR 0018), as a SET signed ES256 with the
 * exact URL of this endpoint as `aud`. No Basic credentials: the signature
 * and `aud` are the whole authentication, so the path is exempt from the
 * CSRF origin check. The account's Localman data is deleted before the
 * answer: 202 once done, and for a subject Localman never knew (or already
 * deleted), so a redelivery is harmless. Any other answer makes the IdP
 * retry. Logs never carry the SET or the subject.
 */
export function registerAccountDeletedRoute(
	router: Router,
	options: AccountDeletedRouteOptions,
): void {
	router.post(
		INTERNAL_PATHS.accountDeleted,
		noStore,
		ipRateLimit(options.limitPerMinute ?? DEFAULT_SERVER_LIMIT_PER_MINUTE),
		express.text({ type: SET_MEDIA_TYPE, limit: BODY_LIMIT }),
		asyncHandler(async (req, res) => {
			const token: unknown = req.body;
			if (!req.is(SET_MEDIA_TYPE) || typeof token !== "string") {
				throw notASet(`Body must be ${SET_MEDIA_TYPE}`);
			}
			if (token.trim() === "") throw notASet("Missing security event token");
			const event = await verified(token.trim(), options);
			if (event.type !== ACCOUNT_DELETED_EVENT) {
				throw notASet("Expected the account.deleted event");
			}
			const user = await UserModel.findOne(
				{ sub: event.sub },
				{ _id: 1 },
			).lean<{ _id: Types.ObjectId }>();
			if (!user) {
				res.status(202).json({ status: "unknown" });
				return;
			}
			await deleteAccount(event.sub);
			options.logger.info(
				{ userId: user._id.toHexString() },
				"Deleted an account deleted at the IdP",
			);
			res.status(202).json({ status: "deleted" });
		}),
	);
}
