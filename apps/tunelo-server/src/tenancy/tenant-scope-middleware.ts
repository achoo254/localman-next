import { DEFAULTS } from "@tunelo/shared";
import type { RequestHandler } from "express";
import { tenantDirectory } from "./tenant-directory.js";
import { type TunnelTenant, runInTenant } from "./tunnel-tenant.js";

/**
 * First middleware: the rest of the request runs in the tenant of its
 * Host. A host Tunelo does not serve gets 421, except `/health` probed on
 * loopback (answered by `health`); 503 if the lookup itself fails.
 */
export function tenantScope(health: RequestHandler): RequestHandler {
	return async (req, res, next) => {
		let tenant: TunnelTenant | undefined;
		try {
			tenant = await tenantDirectory().byHost(req.headers.host ?? "");
		} catch {
			res
				.status(503)
				.type("text/plain")
				.send("This domain cannot be served right now");
			return;
		}
		if (tenant) {
			runInTenant(tenant, next);
			return;
		}
		if (req.path === DEFAULTS.HEALTH_PATH) {
			health(req, res, next);
			return;
		}
		res.status(421).type("text/plain").send("Unknown host");
	};
}
