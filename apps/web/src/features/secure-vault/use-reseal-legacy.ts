import {
	type LocalValue,
	type LocalValueWrite,
	isVaultCiphertext,
} from "@localman/shared/api-client";
import { useEffect, useRef } from "react";
import { patchLocalWhenDue } from "../environments/local-values-api";
import { useKnownVaultState } from "./use-vault-state";
import type { LocalTarget } from "./vault-codec";

/**
 * The writes that move `plain` values into the vault, worked out from the
 * scope's values as they are when the write's turn comes: only names
 * whose value is still exactly that plain value (not changed meanwhile,
 * not sealed already), with the agents' copy when the server keeps one.
 */
export function resealWrites(
	plain: ReadonlyMap<string, string>,
	current: readonly LocalValue[],
): LocalValueWrite[] {
	return current.flatMap((entry): LocalValueWrite[] => {
		if (plain.get(entry.key) !== entry.value) return [];
		if (isVaultCiphertext(entry.value)) return [];
		const copy = entry.agentUse ? { agentValue: entry.value } : {};
		return [{ key: entry.key, value: entry.value, ...copy }];
	});
}

/**
 * Local values of secrets saved before the vault (plain on the server,
 * sealed there with its key) move into the vault once it is open on this
 * device: the browser saves them again, which encrypts them (phase 21:
 * "re-encrypt when the passphrase is set"). `values` are the server's
 * (not opened). The write waits its turn behind the scope's other writes
 * (the table's autosave included) and rereads the values then (`read`,
 * the cache), so an edit made meanwhile is never overwritten: one saved
 * before is left alone, one saved after replaces this. Each set of names
 * is tried once per page; after a failure it is tried again the next
 * time the vault opens or the set changes. It never asks the server
 * about the vault itself (the lock button does).
 */
export function useResealLegacy(
	target: LocalTarget | null,
	values: readonly LocalValue[],
	read: () => readonly LocalValue[] | undefined,
	store: (values: LocalValue[]) => void,
): void {
	const { status } = useKnownVaultState();
	const tried = useRef(new Set<string>());
	const legacy = target
		? values.filter(
				(entry) =>
					target.secretKeys.has(entry.key) &&
					entry.value !== "" &&
					!isVaultCiphertext(entry.value),
			)
		: [];
	const signature = `${target?.path ?? ""}\u0000${legacy.map((entry) => entry.key).join("\u0000")}`;
	const latest = useRef({ target, legacy, read, store });
	latest.current = { target, legacy, read, store };
	useEffect(() => {
		const { target: to, legacy: found } = latest.current;
		if (to === null || status !== "unlocked" || found.length === 0) return;
		if (tried.current.has(signature)) return;
		tried.current.add(signature);
		const plain = new Map(found.map((entry) => [entry.key, entry.value]));
		patchLocalWhenDue(to, (answered) =>
			resealWrites(plain, answered ?? latest.current.read() ?? []),
		)
			.then((saved) => {
				if (saved) latest.current.store(saved);
			})
			.catch(() => tried.current.delete(signature));
	}, [status, signature]);
}
