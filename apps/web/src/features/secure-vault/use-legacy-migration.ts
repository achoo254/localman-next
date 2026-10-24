import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ENVIRONMENTS_KEY } from "../environments/use-environments";
import { useKnownVaultState } from "./use-vault-state";
import { migrateLegacyValues } from "./vault-migration";

/**
 * Each time the vault opens on this device (created, unlocked, or found
 * unlocked on load), moves the person's pre-vault secret values into it
 * (`migrateLegacyValues`), then reloads local values if any moved. A
 * failure is retried the next time the vault opens. It never asks the
 * server about the vault itself: until something does, the vault is not
 * open here.
 */
export function useLegacyMigration(): void {
	const { status } = useKnownVaultState();
	const client = useQueryClient();
	const running = useRef(false);
	useEffect(() => {
		if (status !== "unlocked" || running.current) return;
		running.current = true;
		migrateLegacyValues()
			.then((moved) => {
				if (moved > 0) {
					void client.invalidateQueries({ queryKey: ENVIRONMENTS_KEY });
				}
			})
			.catch(() => undefined)
			.finally(() => {
				running.current = false;
			});
	}, [status, client]);
}
