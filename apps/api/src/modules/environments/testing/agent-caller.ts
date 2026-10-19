import { type AnyOperation, executeOperation } from "@localman/operations";
import { USER_SCOPE } from "../../../http/require-auth.js";

/**
 * TEST ONLY. Runs an operation as an agent acting for `sub`: a token
 * caller with the user's scope and no browser session, as Localman MCP
 * calls it. Returns the validated output.
 */
export async function callAsAgent(
	op: AnyOperation,
	sub: string,
	input: object,
): Promise<unknown> {
	const { output } = await executeOperation(op, {
		auth: { subjectId: sub, scopes: [USER_SCOPE] },
		clientIp: "198.51.100.9",
		readRequest: () => ({ dryRun: false, input }),
	});
	return output;
}
