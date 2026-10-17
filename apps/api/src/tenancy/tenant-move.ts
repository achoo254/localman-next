import type { Types } from "mongoose";
import {
	type TokenCipher,
	TokenCipherError,
} from "../modules/auth/token-cipher.js";
import { environmentScope } from "../modules/environments/environment-model.js";
import { globalsScope } from "../modules/environments/global-variables-model.js";
import {
	localSlot,
	sharedSlot,
} from "../modules/environments/secret-cipher.js";

/**
 * Moving one tenant's data to a self-hosted install, where it becomes the
 * install's primary tenant (hoandat-auth ADR 0007 §7): which collections
 * move, and the sealed values that are sealed again on the way, since the
 * shared server's variable keyring never leaves it.
 */

/**
 * Collections that do not move: sessions, sign-in links and transactions,
 * locks, rate limits, queues, MCP tokens and Tunelo machine links. They
 * hold state of the server they were written on, or keys the install cannot
 * open (link tokens are sealed with the session keyring), and refill.
 */
export const COLLECTIONS_NOT_MOVED: ReadonlySet<string> = new Set([
	"sessions",
	"login_transactions",
	"logout_token_jtis",
	"magic_links",
	"rate_limit_windows",
	"outbound_jobs",
	"resource_tree_locks",
	"workspace_locks",
	"run_button_imports",
	"mcp_tokens",
	"tunelo_links",
]);

/** Seals one value again: the new sealed value, or null when it cannot be opened. */
export type Reseal = (sealed: string, slot: string) => string | null;

/** Opens with `from` and seals with `to`, under the same slot. */
export function resealWith(from: TokenCipher, to: TokenCipher): Reseal {
	return (sealed, slot) => {
		try {
			return to.encrypt(from.decrypt(sealed, slot), slot);
		} catch (error) {
			if (error instanceof TokenCipherError) return null;
			throw error;
		}
	};
}

type Doc = Record<string, unknown>;

function asId(value: unknown): Types.ObjectId | string {
	return typeof value === "string" ? value : (value as Types.ObjectId);
}

function resealVariables(
	variables: unknown,
	scope: string,
	reseal: Reseal,
): number {
	if (!Array.isArray(variables)) return 0;
	let unreadable = 0;
	for (const variable of variables as Doc[]) {
		if (variable.sealed !== true || typeof variable.value !== "string")
			continue;
		const value = reseal(
			variable.value,
			sharedSlot(scope, String(variable.id)),
		);
		if (value === null) unreadable += 1;
		else variable.value = value;
	}
	return unreadable;
}

/**
 * Seals again, in place, the sealed values of one document of `collection`
 * (secret variables of environments and workspace globals, and people's
 * local values). Returns how many could not be opened: they are kept as
 * they were and stay unreadable, as on the server they come from.
 */
export function resealDocument(
	collection: string,
	doc: Doc,
	reseal: Reseal,
): number {
	switch (collection) {
		case "environments":
			return resealVariables(
				doc.variables,
				environmentScope(asId(doc._id)),
				reseal,
			);
		case "global_variables":
			return resealVariables(
				doc.variables,
				globalsScope(asId(doc.workspaceId)),
				reseal,
			);
		case "local_variable_values": {
			if (doc.sealed !== true || typeof doc.value !== "string") return 0;
			const slot = localSlot(
				String(doc.userId),
				String(doc.scope),
				String(doc.key),
			);
			const value = reseal(doc.value, slot);
			if (value === null) return 1;
			doc.value = value;
			return 0;
		}
		default:
			return 0;
	}
}
