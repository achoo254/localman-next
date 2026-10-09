import type { Types } from "mongoose";
import { type StoredPlan, storedPlanOf } from "../billing/plan-guard.js";
import { LIVE_PROJECT, ProjectModel } from "../projects/project-model.js";
import { TtlLruCache } from "./ttl-lru-cache.js";

/** A secret is one DNS label (projects use 24 chars of `a-z0-9`). */
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/** Deepest tree (10 levels) is 20 segments; prefixes add a few more. */
const MAX_SEGMENTS = 64;
/** Path fallback for hosts without a wildcard certificate: `/m/:secret/…`. */
const PATH_FALLBACK = "m";

/** Which project a request addresses, and the path below the secret. */
export interface MockAddress {
	readonly secret: string;
	/** Decoded path segments after the secret, prefix still included. */
	readonly segments: readonly string[];
}

/**
 * Decoded segments of a raw (percent-encoded) path. A single trailing
 * slash is ignored; empty segments, bad escapes or absurd depth are not
 * a mock route (`null`).
 */
export function pathSegments(rawPath: string): string[] | null {
	const parts = rawPath.split("/").slice(1);
	if (parts.at(-1) === "") parts.pop();
	if (parts.length > MAX_SEGMENTS) return null;
	const segments: string[] = [];
	for (const part of parts) {
		if (part === "") return null;
		try {
			segments.push(decodeURIComponent(part));
		} catch {
			return null;
		}
	}
	return segments;
}

/**
 * The secret and path of a mock request: from the host
 * `{secret}.{baseDomain}` (ports ignored, case-insensitive like DNS), else
 * from the path `/m/{secret}/…`. `null` when the request addresses no
 * project (`/healthz` on the bare host, malformed paths).
 */
export function readMockAddress(
	hostname: string,
	rawPath: string,
	baseDomain: string,
): MockAddress | null {
	const segments = pathSegments(rawPath);
	if (segments === null) return null;
	const base = baseDomain.replace(/:\d+$/, "").toLowerCase();
	const host = hostname.toLowerCase();
	if (host.endsWith(`.${base}`)) {
		const label = host.slice(0, -(base.length + 1));
		if (DNS_LABEL.test(label)) return { secret: label, segments };
	}
	const [head, secret, ...rest] = segments;
	if (head === PATH_FALLBACK && secret !== undefined) {
		const label = secret.toLowerCase();
		if (DNS_LABEL.test(label)) return { secret: label, segments: rest };
	}
	return null;
}

/**
 * The segments below the project's prefix (`/api/v1` → `api`, `v1`),
 * compared case-sensitively like the rest of the path; `null` when the
 * path is outside the prefix.
 */
export function stripPrefix(
	segments: readonly string[],
	prefix: string,
): string[] | null {
	const expected = prefix.split("/").filter((part) => part !== "");
	if (expected.some((part, index) => segments[index] !== part)) return null;
	return segments.slice(expected.length);
}

/** What the runtime needs of a project. */
export interface MockProject {
	readonly id: Types.ObjectId;
	readonly prefix: string;
	readonly owner: string;
	/** The owner's stored plan; its expiry is checked on every request. */
	readonly ownerPlan: StoredPlan;
}

/**
 * Projects by secret for 60 seconds, unknown secrets included (a flood of
 * random secrets costs one lookup each, then hits the bounded cache). The
 * dashboard runs in the same process and forgets a project when its
 * prefix changes or its deletion starts; other changes (the owner's plan
 * set by the CLI) show within the TTL.
 */
const cache = new TtlLruCache<Promise<MockProject | null>>(10_000, 60_000);

async function loadProject(secret: string): Promise<MockProject | null> {
	const project = await ProjectModel.findOne({ secret, ...LIVE_PROJECT })
		.select("_id prefix owner")
		.lean<{ _id: Types.ObjectId; prefix?: string; owner: string }>();
	if (!project) return null;
	return {
		id: project._id,
		prefix: project.prefix ?? "",
		owner: project.owner,
		ownerPlan: await storedPlanOf(project.owner),
	};
}

/** The live project of `secret`, cached; concurrent misses share one query. */
export function resolveProject(secret: string): Promise<MockProject | null> {
	const cached = cache.get(secret);
	if (cached) return cached;
	const loading = loadProject(secret);
	cache.set(secret, loading);
	// A failed lookup must not be served from the cache.
	loading.catch(() => cache.delete(secret));
	return loading;
}

/** Drops a project from the cache (prefix changed, deletion started). */
export function forgetMockProject(secret: string): void {
	cache.delete(secret);
}

/** TEST ONLY. Empties the cache between tests that reuse secrets. */
export function clearMockProjectCache(): void {
	cache.clear();
}
