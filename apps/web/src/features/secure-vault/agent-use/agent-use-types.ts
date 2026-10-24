import type { VaultStatus } from "../vault-session";

/** One secret variable of a table, as "Let agents use" needs it. */
export interface AgentUseSubject {
	key: string;
	/**
	 * Plaintext of the caller's local value while it can be read, else
	 * `null` (none, or locked in the vault).
	 */
	local: string | null;
	/** The caller has a local value (readable or locked). */
	hasLocal: boolean;
	/** A shared value exists (shown or withheld from the caller). */
	hasShared: boolean;
}

/** "Let agents use" of one scope, handed to its variable table. */
export interface AgentUseScope {
	/** Hosts agents may fill `key` into; `undefined` while off. */
	hostsOf: (key: string) => readonly string[] | undefined;
	vault: VaultStatus;
	/** Opens the dialog to turn it on or edit the hosts. */
	open: (subject: AgentUseSubject) => void;
	turnOff: (subject: AgentUseSubject) => void;
}

/** Only a secret with a value can be filled in for agents. */
export const agentHasValue = (subject: AgentUseSubject): boolean =>
	subject.hasLocal || subject.hasShared;

/**
 * A local value is copied for agents by the browser, so changing its use
 * needs the vault open.
 */
export const agentNeedsVault = (
	subject: AgentUseSubject,
	vault: VaultStatus,
): boolean => subject.hasLocal && vault !== "unlocked";
