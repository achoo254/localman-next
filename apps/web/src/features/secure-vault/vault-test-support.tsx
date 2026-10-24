/**
 * TEST ONLY. The vault API as an in-memory server, and a render helper
 * with the vault's flags on. Tests mock `./vault-api` with it:
 * `vi.mock("./vault-api", async () => (await import("./vault-test-support")).vaultApiDouble)`.
 */
import type { SecretVaultParams } from "@localman/shared/api-client";
import type { ReactNode } from "react";
import { FeaturesContext } from "../../config/features";
import { ApiError } from "../../lib/api-client";
import { ALL_FEATURES } from "../../pages/landing/landing-test-helpers";
import { renderRoutes } from "../../test/render-app";

export const vaultServer = {
	/** `undefined`: the server does not run the vault; `null`: no vault yet. */
	params: undefined as SecretVaultParams | null | undefined,
	/** Thrown by the next saves while set. */
	saveError: null as ApiError | null,
	/** Local values the next reset reports as deleted. */
	deleted: 0,
	resets: 0,
};

export function resetVaultServer(
	params: SecretVaultParams | null | undefined,
): void {
	vaultServer.params = params;
	vaultServer.saveError = null;
	vaultServer.deleted = 0;
	vaultServer.resets = 0;
}

export const vaultApiDouble = {
	fetchVaultParams: async () => vaultServer.params,
	saveVaultParams: async (params: SecretVaultParams) => {
		if (vaultServer.saveError) throw vaultServer.saveError;
		vaultServer.params = params;
		return params;
	},
	resetVaultOnServer: async () => {
		vaultServer.resets += 1;
		vaultServer.params = null;
		return vaultServer.deleted;
	},
};

export const serverError = (message: string): ApiError =>
	new ApiError(503, "SERVICE_UNAVAILABLE", message);

/** Renders `element` under the app providers with every flag on. */
export function renderVault(element: ReactNode) {
	return renderRoutes(
		[
			{
				path: "*",
				element: (
					<FeaturesContext value={ALL_FEATURES}>{element}</FeaturesContext>
				),
			},
		],
		"/",
	);
}
