import { MAX_RESOURCE_BYTES } from "@localman/shared";
import { z } from "zod";

/** Path params and texts shared by the resource operations. */
export const projectIdParam = z.string().min(1).max(64);
export const resourceIdParam = z.string().min(1).max(64);
export const RESOURCES_PATH = "/projects/:projectId/resources";
export const ACCESS_NOTE =
	"Unknown or inaccessible projects and resources answer 404; accepted collaborators may read and change them like the owner.";
export const PLAN_NOTE =
	"Fails with 403 PLAN_LIMIT_REACHED (details: limit, max, used) when the project owner already has as many resources, over all their projects, as their plan allows.";
export const SIZE_NOTE =
	"Records are capped at 32 KB of JSON each and 2 MB per resource (413 DATA_TOO_LARGE with details: limit, maxBytes, actualBytes).";
/**
 * Body limit of `PUT …/data`: the 2 MB resource cap plus room for JSON
 * whitespace and escapes. Every other route keeps the 100 KB default.
 */
export const RESOURCE_DATA_BODY_LIMIT = MAX_RESOURCE_BYTES + 512 * 1024;
