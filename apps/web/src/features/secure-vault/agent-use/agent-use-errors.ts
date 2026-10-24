/**
 * Why saving the hosts failed, as the dialog shows it: hosts the server
 * refused go back onto their lines; anything else is one message.
 */
import { ApiError } from "../../../lib/api-client";
import { VaultLockedError } from "../vault-session";
import { refusedHosts } from "./agent-hosts";

/** The local value could not be copied for agents; nothing was turned on. */
export class AgentCopyError extends Error {
	constructor(readonly failure: unknown) {
		super("The local value could not be copied for agents");
		this.name = "AgentCopyError";
	}
}

export type AgentSaveFailure =
	| { kind: "refused"; hosts: string[] }
	| {
			kind: "message";
			reason: "notSecret" | "invalid" | "failed" | "copyFailed" | "vaultLocked";
	  };

export function agentSaveFailure(error: unknown): AgentSaveFailure {
	if (error instanceof AgentCopyError) {
		return {
			kind: "message",
			reason:
				error.failure instanceof VaultLockedError
					? "vaultLocked"
					: "copyFailed",
		};
	}
	if (!(error instanceof ApiError))
		return { kind: "message", reason: "failed" };
	if (error.code === "AGENT_HOST_NOT_ALLOWED") {
		const hosts = refusedHosts(error.details);
		if (hosts.length > 0) return { kind: "refused", hosts };
	}
	if (error.code === "AGENT_USE_NOT_SECRET") {
		return { kind: "message", reason: "notSecret" };
	}
	if (error.status === 400) return { kind: "message", reason: "invalid" };
	return { kind: "message", reason: "failed" };
}
