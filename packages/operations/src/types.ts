import type { z } from "zod";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/** Express router method and OpenAPI path-item key for each HTTP method. */
export const LOWERCASE_METHOD = {
	GET: "get",
	POST: "post",
	PUT: "put",
	PATCH: "patch",
	DELETE: "delete",
} as const satisfies Record<HttpMethod, Lowercase<HttpMethod>>;

/** Query flag that turns a call to a `dryRun` operation into a preview. */
export const DRY_RUN_QUERY_PARAM = "dryRun";

/**
 * MCP token scope required, on top of the toolset scope, by tools that mint
 * a credential (personal access token, service-account secret, access key).
 */
export const CREDENTIALS_WRITE_SCOPE = "credentials:write";

/** MCP toolsets a client can enable; one per product area. */
export const TOOLSETS = [
	"mock",
	"mock-advanced",
	"client",
	"sharing",
	"collab",
	"public",
	"sync",
	"traffic",
	"devops",
	"tunnels",
	"users",
	"notifications",
	"admin",
	"feedback",
] as const;
export type Toolset = (typeof TOOLSETS)[number];

/**
 * Toolsets an MCP client gets when it does not choose (`?toolsets=`).
 * A toolset without any tool yet simply contributes nothing.
 */
export const DEFAULT_TOOLSETS: readonly Toolset[] = ["mock", "client"];

export const SUCCESS_STATUSES = [200, 201] as const;
export type SuccessStatus = (typeof SUCCESS_STATUSES)[number];

/**
 * Identity resolved from a request. Authentication modules extend this
 * interface through declaration merging when they need more fields.
 */
export interface AuthContext {
	readonly subjectId: string;
	readonly scopes: readonly string[];
}

/** Transport-neutral context shared by REST routes and MCP tools. */
export interface OperationContext {
	readonly auth: AuthContext | null;
	/** True when the caller asked for a preview; handler must not mutate. */
	readonly dryRun: boolean;
	/**
	 * Network address of the caller as the transport resolved it (over HTTP,
	 * Express `req.ip`, which honours `trust proxy`); `null` when unknown.
	 * For per-client limits only, never for authorization.
	 */
	readonly clientIp: string | null;
}

/** What a `guard` can see: the caller, not the request's input or flags. */
export type OperationGuardContext = Pick<OperationContext, "auth" | "clientIp">;

export interface OperationAnnotations {
	readonly readOnly: boolean;
	readonly destructive: boolean;
	readonly idempotent: boolean;
}

/** `true` exposes an MCP tool; `{ exempt }` opts out with a written reason. */
export type McpExposure = true | { readonly exempt: string };

/**
 * Inputs are merged from path params, query and JSON body into one object,
 * so the input schema must be a zod object.
 */
export type OperationInputSchema = z.ZodObject<
	z.ZodRawShape,
	z.core.$ZodObjectConfig
>;

// `policy` and `handler` use method syntax on purpose: method parameters are
// bivariant, which lets a concrete operation be stored in an `AnyOperation[]`.
export interface OperationSpec<
	I extends OperationInputSchema,
	O extends z.ZodType,
> {
	/** `<toolset>.<verbNoun>`, e.g. `mock.listResources`. */
	readonly id: string;
	readonly method: HttpMethod;
	/** Express path relative to the API mount, e.g. `/projects/:projectId`. */
	readonly path: string;
	readonly summary?: string;
	readonly description?: string;
	readonly input: I;
	readonly output: O;
	/** Every listed scope is required; an empty list makes the route public. */
	readonly scopes: readonly string[];
	/**
	 * Caller check that needs no input (e.g. "owners only"). Runs right
	 * after the scope check, before the input is parsed, so a refused
	 * caller always gets 403 and learns nothing from validation errors.
	 */
	guard?(ctx: OperationGuardContext): boolean | Promise<boolean>;
	policy?(
		ctx: OperationContext,
		input: z.output<I>,
	): boolean | Promise<boolean>;
	readonly annotations: OperationAnnotations;
	readonly toolset: Toolset;
	readonly mcp: McpExposure;
	/** Required (true) for destructive operations. */
	readonly dryRun?: boolean;
	/**
	 * True when the operation mints a credential whose secret is returned
	 * once (PAT, service-account secret, access key). Its MCP tool then
	 * also needs the `credentials:write` token scope.
	 */
	readonly createsCredential?: boolean;
	/**
	 * The MCP tool must be confirmed: a `dry_run` call returns a
	 * `confirm_token` the real call has to present. Only for changes with a
	 * wide blast radius (delete a project, a resource tree, reset all data,
	 * rotate a project secret); needs `dryRun: true`.
	 */
	readonly requiresConfirmation?: boolean;
	/**
	 * Largest JSON body in bytes this route accepts, when it needs more
	 * than the server-wide default (e.g. a whole resource's records). The
	 * server mounts a parser with this limit for this route only.
	 */
	readonly bodyLimit?: number;
	readonly successStatus?: SuccessStatus;
	handler(
		ctx: OperationContext,
		input: z.output<I>,
	): z.input<O> | Promise<z.input<O>>;
}

export interface OperationDefinition<
	I extends OperationInputSchema = OperationInputSchema,
	O extends z.ZodType = z.ZodType,
> extends OperationSpec<I, O> {
	readonly dryRun: boolean;
	readonly createsCredential: boolean;
	readonly requiresConfirmation: boolean;
	readonly successStatus: SuccessStatus;
}

export type AnyOperation = OperationDefinition<OperationInputSchema, z.ZodType>;
