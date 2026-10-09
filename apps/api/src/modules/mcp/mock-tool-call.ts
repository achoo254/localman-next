import { OperationError } from "@localman/operations";
import { DEFAULT_RESPONSE, type MockToolAction } from "@localman/shared";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { Logger } from "../../logger.js";
import { runEndpoint } from "../mock-runtime/mock-endpoints.js";
import type { MockTarget } from "../mock-runtime/mock-records.js";
import {
	admitMonthly,
	monthlyQuotaExceeded,
} from "../mock-runtime/mock-router.js";
import { type MockLimiters, rateLimited } from "../mock-runtime/rate-limit.js";
import {
	type EndpointKind,
	renderResponse,
} from "../mock-runtime/render-response.js";
import type { MockProject } from "../mock-runtime/resolve-project.js";
import type { UsageMeter } from "../mock-runtime/usage-meter.js";
import { RecordModel } from "../resources/record-model.js";
import type { StoredResource } from "../resources/resource-model.js";
import { parentKeyIn } from "../resources/resource-store.js";
import { readToolArgs } from "./mock-tool-args.js";
import { toolBehaviorResult } from "./mock-tool-behavior.js";
import type {
	MockToolDefinition,
	MockToolTarget,
} from "./mock-tool-factory.js";
import { toolFailure, toolSuccess } from "./operation-tool-result.js";
import type { ToolArgs } from "./operation-tool-schema.js";

export interface MockToolDeps {
	readonly logger: Logger;
	readonly meter: UsageMeter;
	readonly limiters: MockLimiters;
}

/** The project a mock MCP request addresses, as loaded for it. */
export interface MockToolScope {
	readonly secret: string;
	/** Client IP (Express `trust proxy`), for the per-IP rate limit. */
	readonly clientIp: string | null;
	readonly project: MockProject;
	readonly resources: readonly StoredResource[];
	/** Aborts when the HTTP request closes (ends chaos waits early). */
	readonly signal?: AbortSignal;
}

const KIND_OF: Readonly<Record<MockToolAction, EndpointKind>> = {
	list: "list",
	get: "one",
	create: "create",
	update: "update",
	delete: "delete",
};

function notFound(): OperationError {
	return new OperationError(404, "NOT_FOUND", "Not found");
}

/**
 * The records above `parentId`, outermost first, found by walking up the
 * stored `parentRecordId` links along the tool's ancestor resources:
 * what the nested REST route `/users/{u}/posts/{parentId}/…` names.
 * `null` when a record on the way is missing (the route answers 404).
 */
async function ancestorsOf(
	byId: ReadonlyMap<string, StoredResource>,
	target: MockToolTarget,
	parentId: string,
): Promise<MockTarget["ancestors"] | null> {
	const ancestors: { resource: StoredResource; recordId: string }[] = [];
	let recordId: string | null = parentId;
	for (let level = target.parentChain.length - 1; level >= 0; level -= 1) {
		const resource = byId.get(target.parentChain[level] ?? "");
		if (!resource || recordId === null) return null;
		ancestors.unshift({ resource, recordId });
		if (level === 0) break;
		const record: { parentRecordId?: string | null } | null =
			await RecordModel.findOne({
				resourceId: resource._id,
				id: recordId,
			})
				.select("parentRecordId")
				.lean<{ parentRecordId?: string | null }>();
		if (!record) return null;
		recordId = record.parentRecordId ?? null;
	}
	return ancestors;
}

/** The REST target of a tool: nested under `parentId`, else the flat route. */
async function targetOf(
	scope: MockToolScope,
	target: MockToolTarget,
	parentId: string | null,
): Promise<MockTarget | null> {
	const byId = new Map(scope.resources.map((r) => [r._id.toHexString(), r]));
	const resource = byId.get(target.resourceId);
	if (!resource) return null;
	const ancestors =
		parentId === null ? [] : await ancestorsOf(byId, target, parentId);
	if (ancestors === null) return null;
	return {
		projectId: scope.project.id,
		resources: scope.resources,
		resource,
		parentKey: parentKeyIn(scope.resources, resource),
		ancestors,
	};
}

async function run(
	tool: MockToolDefinition,
	args: ToolArgs,
	scope: MockToolScope,
	{ meter, limiters }: MockToolDeps,
): Promise<CallToolResult> {
	const { action } = tool.target;
	const writes = action !== "list" && action !== "get";
	// The HTTP request was admitted as a read; each call is admitted again
	// (IP, secret, writes, byte budget), so no request runs past the limits.
	const admitted = limiters.admit(
		scope.clientIp,
		scope.secret,
		writes ? "POST" : "GET",
	);
	if (!admitted.ok) throw rateLimited(admitted.retryAfterSeconds);
	if (!(await admitMonthly(meter, scope.project))) {
		throw monthlyQuotaExceeded();
	}
	const call = readToolArgs(tool, args);
	const target = await targetOf(scope, tool.target, call.parentId);
	if (!target) throw notFound();
	const charge = (bytes: number) =>
		limiters.chargeResponse(scope.secret, bytes);
	const answer = await toolBehaviorResult(
		KIND_OF[action],
		target,
		call,
		scope.signal,
		charge,
	);
	if (answer) return answer;
	const result = await runEndpoint(
		KIND_OF[action],
		target,
		call.recordId,
		call.call,
		false,
	);
	if (result.data === null) throw notFound();
	// Custom responses shape REST bodies only: MCP gets the data as is,
	// within the same size cap and byte budget.
	const rendered = renderResponse(DEFAULT_RESPONSE, result.data, null);
	charge(Math.max(rendered.bytes, result.readBytes));
	return toolSuccess(
		action === "list"
			? { items: result.data, total: result.count }
			: result.data,
	);
}

/**
 * Runs a mock tool like its REST endpoint: every call is admitted by the
 * per-IP and per-secret rates and the secret's byte budget (a write also
 * by the write rate), on top of the HTTP request that carried it, and
 * counts one request of the owner's monthly quota (and the project's
 * activity); then the same CRUD and query code runs on the shared store. Failures come back as tool errors with the
 * REST error body (`{ error: { code, message } }`).
 */
export async function callMockTool(
	tool: MockToolDefinition,
	args: ToolArgs,
	scope: MockToolScope,
	deps: MockToolDeps,
): Promise<CallToolResult> {
	try {
		return await run(tool, args, scope, deps);
	} catch (error) {
		return toolFailure(error, tool.name, deps.logger);
	}
}
