import { OperationError } from "@localman/operations";
import type { Request, Response, Router } from "express";
import { errors } from "jose";
import { MCP_PATHS } from "../../operations/protocol-routes.js";
import {
	IdpUnavailableError,
	authUnavailableError,
} from "../auth/oidc-errors.js";
import {
	type AccessTokenKeys,
	InvalidAccessTokenError,
	type McpAccessToken,
	verifyMcpAccessToken,
} from "./mcp-access-token.js";

export const MCP_PATH = MCP_PATHS.mcp;
export const RESOURCE_METADATA_PATH = MCP_PATHS.resourceMetadata;
/** RFC 9728 §3.1: the well-known path with the resource's path appended. */
const MCP_METADATA_PATH = MCP_PATHS.mcpResourceMetadata;

/** Localman MCP as an OAuth 2.1 resource server of the shared IdP. */
export interface McpResourceSettings {
	/** `PUBLIC_URL`; the resource is `{PUBLIC_URL}/mcp`. */
	readonly publicUrl: string;
	/** `OIDC_ISSUER`, the only authorization server. */
	readonly issuer: string;
	/** Token scopes the reachable tools need (`mock:read`, `mock:write`…). */
	readonly scopesSupported: readonly string[];
	readonly keys: AccessTokenKeys;
}

/** RFC 8707 resource indicator: the `aud` of every accepted token. */
export function mcpResourceUrlOf(publicUrl: string): string {
	return new URL(MCP_PATH, publicUrl).href;
}

/** URL of the metadata document, advertised in every challenge. */
export function resourceMetadataUrlOf(publicUrl: string): string {
	return new URL(MCP_METADATA_PATH, publicUrl).href;
}

/** RFC 9728 Protected Resource Metadata of `{PUBLIC_URL}/mcp`. */
export function protectedResourceMetadata(settings: McpResourceSettings) {
	return {
		resource: mcpResourceUrlOf(settings.publicUrl),
		authorization_servers: [settings.issuer],
		scopes_supported: [...settings.scopesSupported],
		bearer_methods_supported: ["header"],
		resource_name: "Localman MCP",
	};
}

/** Browser-based MCP clients read the metadata cross-origin. */
const METADATA_CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "*",
};

/**
 * `GET /.well-known/oauth-protected-resource` and its path-aware form
 * `/.well-known/oauth-protected-resource/mcp` (RFC 9728) answer the same
 * public document.
 */
export function registerResourceMetadataRoutes(
	router: Router,
	settings: McpResourceSettings,
): void {
	const document = protectedResourceMetadata(settings);
	for (const path of [RESOURCE_METADATA_PATH, MCP_METADATA_PATH]) {
		router.options(path, (_req, res) => {
			res.set(METADATA_CORS).status(204).end();
		});
		router.get(path, (_req, res) => {
			res.set(METADATA_CORS).set("Cache-Control", "public, max-age=300");
			res.json(document);
		});
	}
}

/** RFC 6750 §3 auth-param value: a quoted string without `"` or `\`. */
function quoted(value: string): string {
	return `"${value.replace(/["\\]/g, "")}"`;
}

interface ChallengeError {
	readonly error: "invalid_token" | "insufficient_scope";
	readonly description: string;
	readonly scopes?: readonly string[];
}

/** `WWW-Authenticate` of a refused request; no `error` when no token came. */
export function bearerChallenge(
	metadataUrl: string,
	problem?: ChallengeError,
): string {
	const params: string[] = [];
	if (problem) {
		params.push(`error=${quoted(problem.error)}`);
		params.push(`error_description=${quoted(problem.description)}`);
		if (problem.scopes)
			params.push(`scope=${quoted(problem.scopes.join(" "))}`);
	}
	params.push(`resource_metadata=${quoted(metadataUrl)}`);
	return `Bearer ${params.join(", ")}`;
}

/** A verified token with its raw value (kept in memory, never logged). */
export interface VerifiedBearer extends McpAccessToken {
	readonly token: string;
}

/** RFC 6750 §2.1 `b64token`; the scheme is case-insensitive. */
const BEARER_HEADER = /^Bearer +([A-Za-z0-9\-._~+/]+=*)$/i;

/**
 * 403 `insufficient_scope` naming every scope the request needs, so the
 * client can ask the user once for all of them (step-up authorization).
 */
export function refuseInsufficientScope(
	res: Response,
	settings: McpResourceSettings,
	scopes: readonly string[],
): OperationError {
	const metadataUrl = resourceMetadataUrlOf(settings.publicUrl);
	const description = `The access token needs one of the scopes: ${scopes.join(" ")}`;
	res.set(
		"WWW-Authenticate",
		bearerChallenge(metadataUrl, {
			error: "insufficient_scope",
			description,
			scopes,
		}),
	);
	return new OperationError(403, "INSUFFICIENT_SCOPE", description);
}

/**
 * The verified Bearer access token of `req`. Only the `Authorization`
 * header counts: a session cookie never authenticates here. On failure
 * the challenge header is set and an `OperationError` is thrown (401 when
 * the token is missing or invalid, 503 when the IdP's keys are unreachable).
 */
export async function authenticateBearer(
	req: Request,
	res: Response,
	settings: McpResourceSettings,
): Promise<VerifiedBearer> {
	const metadataUrl = resourceMetadataUrlOf(settings.publicUrl);
	const header = req.headers.authorization;
	if (!header || !/^Bearer(?: |$)/i.test(header)) {
		res.set("WWW-Authenticate", bearerChallenge(metadataUrl));
		throw new OperationError(
			401,
			"UNAUTHENTICATED",
			"A Bearer access token from the authorization server is required",
		);
	}
	const invalid = (description: string): OperationError => {
		res.set(
			"WWW-Authenticate",
			bearerChallenge(metadataUrl, { error: "invalid_token", description }),
		);
		return new OperationError(401, "INVALID_TOKEN", description);
	};
	const token = BEARER_HEADER.exec(header)?.[1];
	if (!token) throw invalid("Malformed Bearer token");
	try {
		const access = await verifyMcpAccessToken(
			token,
			settings.keys,
			mcpResourceUrlOf(settings.publicUrl),
		);
		return { ...access, token };
	} catch (error) {
		if (error instanceof InvalidAccessTokenError) {
			throw invalid("The access token is invalid or expired");
		}
		if (
			error instanceof IdpUnavailableError ||
			error instanceof errors.JOSEError
		) {
			throw authUnavailableError();
		}
		throw error;
	}
}
