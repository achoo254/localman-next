import { OperationError } from "@localman/operations";
import type { RequestHandler } from "express";
import { type LocalmanTenant, runInTenant } from "./tenant-context.js";
import type { TenantDirectory } from "./tenant-directory.js";

/**
 * First middleware of both servers: the rest of the request runs in the
 * tenant of its Host (port included). A host of no tenant gets 421,
 * except `/healthz` (probed on the loopback address), which reads no
 * tenant data; 503 when the tenant cannot be looked up.
 */
export function tenantScope(directory: () => TenantDirectory): RequestHandler {
	return async (req, _res, next) => {
		let tenant: LocalmanTenant | undefined;
		try {
			tenant = await directory().byHost(req.host ?? "");
		} catch {
			// The IdP is unreachable and this host was never seen (logged
			// by the directory).
			throw new OperationError(
				503,
				"TENANT_UNAVAILABLE",
				"This domain cannot be served right now",
			);
		}
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
