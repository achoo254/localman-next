import { Alert } from "../../../components/ui/alert";
import { useT } from "../../../i18n/i18n-context";

/** Whether the import dialog may import an environment file, or why not. */
export type EnvironmentImport = "allowed" | "unavailable" | "viewer";

/** Why an environment file can't be imported here (shown in the dialog). */
export function EnvironmentImportNote({
	reason,
}: {
	reason: Exclude<EnvironmentImport, "allowed">;
}) {
	const t = useT();
	return (
		<Alert tone="info" data-id="modal-import-environment-unavailable">
			{t(
				reason === "viewer"
					? "collections.import.environmentViewer"
					: "collections.import.environmentUnavailable",
			)}
		</Alert>
	);
}
