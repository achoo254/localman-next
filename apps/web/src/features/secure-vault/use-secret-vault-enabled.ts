import { useFeatures } from "../../config/features";
import { useEnvironmentsEnabled } from "../environments/use-environments-enabled";

/**
 * The vault's screens (lock button, dialogs, "let agents use"): they need
 * local values, hence environments. Encryption itself follows the server
 * (`vault-session.ts`), so data stays right whatever the build shows.
 */
export function useSecretVaultEnabled(): boolean {
	const { secretVault } = useFeatures();
	return useEnvironmentsEnabled() && secretVault;
}
