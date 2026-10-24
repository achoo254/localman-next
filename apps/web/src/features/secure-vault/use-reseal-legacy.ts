import {
	type LocalValue,
	type LocalValueWrite,
	isVaultCiphertext,
} from "@localman/shared/api-client";
import { useEffect, useRef } from "react";
import { useKnownVaultState } from "./vault-session";

/**
 * Local values of secrets saved before the vault (plain on the server,
 * sealed there with its key) move into the vault once it is open on this
 * device: the browser saves them again, which encrypts them (phase 21:
 * "re-encrypt when the passphrase is set"). `values` are the server's
 * (not opened); `save` writes like the scope's editor does. Each set of
 * names is tried once per page; a failure lets the next render retry.
 * It never asks the server about the vault itself (the lock button does).
 */
export function useResealLegacy(
	scope: string | null,
	values: readonly LocalValue[],
	secretKeys: ReadonlySet<string>,
	save: (writes: LocalValueWrite[]) => Promise<unknown>,
): void {
	const { status } = useKnownVaultState();
	const tried = useRef(new Set<string>());
	const legacy = values.filter(
		(entry) =>
			secretKeys.has(entry.key) &&
			entry.value !== "" &&
			!isVaultCiphertext(entry.value),
	);
	const signature = `${scope ?? ""}\u0000${legacy.map((entry) => entry.key).join("\u0000")}`;
	const saveRef = useRef(save);
	saveRef.current = save;
	const pending = useRef(legacy);
	pending.current = legacy;
	useEffect(() => {
		const writes = pending.current;
		if (scope === null || status !== "unlocked" || writes.length === 0) return;
		if (tried.current.has(signature)) return;
		tried.current.add(signature);
		saveRef
			.current(writes.map((entry) => ({ key: entry.key, value: entry.value })))
			.catch(() => tried.current.delete(signature));
	}, [scope, status, signature]);
}
