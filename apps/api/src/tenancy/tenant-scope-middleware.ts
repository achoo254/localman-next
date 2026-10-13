import { OperationError } from "@localman/operations";
import type { RequestHandler } from "express";
import { runInTenant } from "./tenant-context.js";
import type { TenantDirectory } from "./tenant-directory.js";

/**
 * First middleware of both servers: the rest of the request runs in the
 * tenant of its Host (port included). A host of no tenant gets 421,
 * except `/healthz` (probed on the loopback address), which reads no
 * tenant data.
 */
export function tenantScope(directory: () => TenantDirectory): RequestHandler {
	return async (req, _res, next) => {
		const tenant = await directory().byHost(req.host ?? "");
		if (tenant) {
			runInTenant(tenant, next);
			return;
		}
		if (req.path === "/healthz") {
			next();
			return;
		}
		throw new OperationError(421, "MISDIRECTED_REQUEST", "Unknown host");
	};
}
