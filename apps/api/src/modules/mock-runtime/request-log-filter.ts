import { OperationError } from "@localman/operations";
import { z } from "zod";
import {
	REQUEST_LOG_SOURCES,
	type RequestLogSource,
	type StoredRequestLog,
} from "./request-log-model.js";

/** Query of the list operation and the live stream (all optional, ANDed). */
export const logFilterInput = {
	/** Comma-separated methods, e.g. `GET,POST`. */
	method: z.string().max(100).optional(),
	/** Comma-separated codes or classes, e.g. `404,5xx`. */
	status: z.string().max(100).optional(),
	/** Comma-separated sources: mock, rule, upstream, inbox, callback. */
	source: z.string().max(100).optional(),
	/** Case-insensitive substring of the path. */
	path: z.string().max(200).optional(),
};

export interface LogFilterQuery {
	readonly method?: string | undefined;
	readonly status?: string | undefined;
	readonly source?: string | undefined;
	readonly path?: string | undefined;
}

interface StatusRange {
	readonly min: number;
	readonly max: number;
}

export interface LogFilter {
	readonly methods: readonly string[] | null;
	readonly statuses: readonly StatusRange[] | null;
	readonly sources: readonly RequestLogSource[] | null;
	readonly path: string | null;
}

const isSource = (value: string): value is RequestLogSource =>
	REQUEST_LOG_SOURCES.some((source) => source === value);

const METHOD = /^[A-Z]{1,16}$/;
const STATUS = /^([1-5])(\d\d|xx)$/;

function invalid(field: string, message: string): OperationError {
	return new OperationError(400, "VALIDATION_ERROR", "Invalid input", [
		{ path: field, message },
	]);
}

function listOf(value: string | undefined): string[] {
	return (value ?? "")
		.split(",")
		.map((part) => part.trim())
		.filter((part) => part !== "");
}

/** Parses the filter; 400 `VALIDATION_ERROR` on a malformed part. */
export function parseLogFilter(query: LogFilterQuery): LogFilter {
	const methods = listOf(query.method).map((m) => m.toUpperCase());
	if (methods.some((m) => !METHOD.test(m))) {
		throw invalid("method", "must be HTTP methods separated by commas");
	}
	const statuses = listOf(query.status).map((part): StatusRange => {
		const match = STATUS.exec(part.toLowerCase());
		if (!match) throw invalid("status", "must be codes like 404 or 5xx");
		const [, digit = "", rest = ""] = match;
		if (rest === "xx") {
			const base = Number(digit) * 100;
			return { min: base, max: base + 99 };
		}
		const code = Number(`${digit}${rest}`);
		return { min: code, max: code };
	});
	const sources = listOf(query.source).map((part) => part.toLowerCase());
	if (!sources.every(isSource)) {
		throw invalid("source", `must be among ${REQUEST_LOG_SOURCES.join(", ")}`);
	}
	const path = query.path?.trim() ?? "";
	return {
		methods: methods.length > 0 ? methods : null,
		statuses: statuses.length > 0 ? statuses : null,
		sources: sources.length > 0 ? sources : null,
		path: path === "" ? null : path,
	};
}

/** Whether a live line passes the filter (same rules as `toMongoFilter`). */
export function matchesLogFilter(
	line: Pick<StoredRequestLog, "method" | "status" | "source" | "path">,
	filter: LogFilter,
): boolean {
	if (filter.methods && !filter.methods.includes(line.method)) return false;
	if (filter.sources && !filter.sources.includes(line.source)) return false;
	if (
		filter.statuses &&
		!filter.statuses.some((r) => line.status >= r.min && line.status <= r.max)
	) {
		return false;
	}
	return (
		filter.path === null ||
		line.path.toLowerCase().includes(filter.path.toLowerCase())
	);
}

const escapeRegex = (text: string): string =>
	text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Mongo conditions of the filter, added to `{ projectId }`. */
export function toMongoFilter(filter: LogFilter): Record<string, unknown> {
	return {
		...(filter.methods ? { method: { $in: filter.methods } } : {}),
		...(filter.sources ? { source: { $in: filter.sources } } : {}),
		...(filter.statuses
			? {
					$or: filter.statuses.map((r) => ({
						status: { $gte: r.min, $lte: r.max },
					})),
				}
			: {}),
		...(filter.path === null
			? {}
			: { path: { $regex: escapeRegex(filter.path), $options: "i" } }),
	};
}
