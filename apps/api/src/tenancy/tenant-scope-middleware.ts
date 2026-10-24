import { OperationError } from "@localman/operations";
import type { Request, RequestHandler, Response } from "express";
import { runInTenant } from "./tenant-context.js";
import type { TenantDirectory } from "./tenant-directory.js";

/**
 * First middleware of both servers: the rest of the request runs in the
 * tenant of its Host (port included). A host Localman does not serve
 * gets 421, except `/healthz` (probed on the loopback address), answered
 * here by `healthz` since every later middleware may need a tenant.
 */
export function tenantScope(
	directory: () => TenantDirectory,
	healthz: (req: Request, res: Response) => void,
): RequestHandler {
	return async (req, res, next) => {
		const tenant = await directory().byHost(req.host ?? "");
		if (tenant) {
			runInTenant(tenant, next);
			return;
		}
		if (req.path === "/healthz") {
			healthz(req, res);
			return;
		}
		throw new OperationError(421, "MISDIRECTED_REQUEST", "Unknown host");
	};
}
