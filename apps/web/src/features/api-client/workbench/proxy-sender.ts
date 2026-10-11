/**
 * Proxy-only sender: every request goes through the Localman proxy
 * (`POST /api/v1/proxy`), with the pre-request script before and the
 * post-response script after. The workbench falls back to it when no
 * sender is given; the API client page passes the router instead.
 */
import type { ScriptRunner } from "@localman/shared/api-client/script-sandbox";
import { proxyHop } from "./proxy-hop";
import { createLazyScriptRunner } from "./script-steps";
import { CANCELLED, failed, finishSend, prepareSend } from "./send-steps";
import type { RequestSender } from "./workbench-types";

export function createProxySender(
	scripts: ScriptRunner = createLazyScriptRunner(),
): RequestSender {
	return async (input) => {
		const ready = await prepareSend(input, scripts);
		if (!ready.ok) return ready.settled;
		const hop = await proxyHop(
			ready.prepared,
			ready.toSend.settings,
			input.signal,
		);
		if (hop.kind === "cancelled") return CANCELLED;
		if (hop.kind === "failed") {
			return failed({ ...hop.failure, preScript: ready.preScript });
		}
		const delivered = { response: hop.response, route: "proxy" as const };
		return finishSend(ready, delivered, scripts);
	};
}
