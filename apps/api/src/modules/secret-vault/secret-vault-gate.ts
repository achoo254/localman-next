/**
 * `SECRET_VAULT_ENABLED`, read at request time by the rules on local
 * values and by `send_request` filling variables (ADR-0009). Its own
 * operations are left out of the registry while off (`feature-gates.ts`).
 */
let enabled = false;

/** Set by `main.ts` from the environment; tests flip it. */
export function configureSecretVault(on: boolean): void {
	enabled = on;
}

export function secretVaultEnabled(): boolean {
	return enabled;
}
