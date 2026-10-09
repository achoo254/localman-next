import { OperationError } from "@localman/operations";
import type { Request, Response } from "express";
import type { Types } from "mongoose";
import { findMcpToken, tokenMatches } from "./mcp-token-model.js";

const REALM = 'Bearer realm="localman-mock-mcp"';
/** Far longer than a real token (`lmmcp_` + 43 characters). */
const MAX_TOKEN_LENGTH = 512;

/** The Bearer token of the request, `null` when absent or malformed. */
function bearerOf(req: Request): string | null {
	const header = req.get("authorization");
	const match = header ? /^Bearer +([^\s]+)$/i.exec(header) : null;
	const token = match?.[1];
	return token !== undefined && token.length <= MAX_TOKEN_LENGTH ? token : null;
}

/**
 * Applies the project's "Require a token for MCP" setting. Lets the
 * request through when the setting is off or the Bearer token matches;
 * otherwise answers 401 with a `WWW-Authenticate: Bearer` challenge
 * (`error="invalid_token"` when a token was sent) and returns false.
 * Read from Mongo on every MCP request, so a rotation applies at once.
 */
export async function admitMcpBearer(
	req: Request,
	res: Response,
	projectId: Types.ObjectId,
): Promise<boolean> {
	const setting = await findMcpToken(projectId);
	if (setting?.required !== true) return true;
	const token = bearerOf(req);
	if (token !== null && setting.tokenHash !== null) {
		if (tokenMatches(token, setting.tokenHash)) return true;
	}
	const sent = req.get("authorization") !== undefined;
	res.setHeader(
		"WWW-Authenticate",
		sent ? `${REALM}, error="invalid_token"` : REALM,
	);
	res
		.status(401)
		.json(
			new OperationError(
				401,
				"UNAUTHENTICATED",
				sent
					? "The Bearer token of this mock's MCP endpoint is wrong or was rotated"
					: "This mock's MCP endpoint requires its Bearer token",
			).toBody(),
		);
	return false;
}
