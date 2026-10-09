import type { z } from "zod";
import { OperationError, validationError } from "./operation-error.js";
import type {
	AnyOperation,
	AuthContext,
	OperationContext,
	OperationInputSchema,
} from "./types.js";

/** What a transport (REST route, MCP tool) supplies for one call. */
export interface OperationCall {
	readonly auth: AuthContext | null;
	readonly clientIp: string | null;
	/** Aborts when the caller goes away; becomes `ctx.signal`. */
	readonly signal?: AbortSignal;
	/**
	 * Reads the dry-run flag and the raw, unvalidated input. Called only
	 * after the scope check and `guard`, so a refused caller always gets
	 * 401/403 and learns nothing from validation errors.
	 */
	readRequest(): {
		readonly dryRun: boolean;
		readonly input: unknown;
	};
	/**
	 * Last check before the handler, with the parsed input (e.g. an MCP
	 * confirm token bound to that input). Throw `OperationError` to refuse.
	 */
	beforeHandler?(
		ctx: OperationContext,
		input: z.output<OperationInputSchema>,
	): void | Promise<void>;
}

export interface OperationResult {
	readonly ctx: OperationContext;
	/** Input after zod parsing (defaults applied). */
	readonly input: z.output<OperationInputSchema>;
	/** Output after validation against the operation's output schema. */
	readonly output: unknown;
}

export function assertScopes(
	required: readonly string[],
	auth: AuthContext | null,
): void {
	if (required.length === 0) return;
	if (!auth) {
		throw new OperationError(401, "UNAUTHENTICATED", "Authentication required");
	}
	const missing = required.filter((scope) => !auth.scopes.includes(scope));
	if (missing.length > 0) {
		throw new OperationError(
			403,
			"FORBIDDEN",
			`Missing required scope: ${missing.join(", ")}`,
		);
	}
}

function forbidden(): OperationError {
	return new OperationError(
		403,
		"FORBIDDEN",
		"You are not allowed to perform this operation",
	);
}

/**
 * Runs one operation the same way for every transport: scope check →
 * `guard` → read and validate input → `policy` → `beforeHandler` →
 * `handler` → validate output. Expected failures are `OperationError`;
 * anything else is a server bug the transport reports as 500.
 */
export async function executeOperation(
	op: AnyOperation,
	call: OperationCall,
): Promise<OperationResult> {
	const { auth, clientIp } = call;
	assertScopes(op.scopes, auth);
	if (op.guard && !(await op.guard({ auth, clientIp }))) throw forbidden();

	const request = call.readRequest();
	const ctx: OperationContext = {
		auth,
		dryRun: request.dryRun,
		clientIp,
		...(call.signal ? { signal: call.signal } : {}),
	};
	const parsedInput = await op.input.safeParseAsync(request.input);
	if (!parsedInput.success) throw validationError(parsedInput.error);
	const input = parsedInput.data;

	if (op.policy && !(await op.policy(ctx, input))) throw forbidden();
	await call.beforeHandler?.(ctx, input);

	const result = await op.handler(ctx, input);
	const parsedOutput = await op.output.safeParseAsync(result);
	if (!parsedOutput.success) {
		// A contract bug on our side: surface as 500, never as a client error.
		throw new Error(
			`Operation "${op.id}" returned output that violates its schema`,
			{ cause: parsedOutput.error },
		);
	}
	return { ctx, input, output: parsedOutput.data };
}
