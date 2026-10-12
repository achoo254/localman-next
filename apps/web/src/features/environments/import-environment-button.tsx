import { IconUpload } from "@tabler/icons-react";
import { useRef } from "react";
import { IconButton } from "../../components/ui/icon-button";
import { useT } from "../../i18n/i18n-context";
import { useImportEnvironment } from "./use-environment-file";

export interface ImportEnvironmentButtonProps {
	workspaceId: string;
	/** Admins and Editors of the workspace import; others see why not. */
	canImport: boolean;
	/** Id of the visible text saying why Import is off. */
	describedBy?: string;
}

/** Picks an environment file (.json) and imports it into the workspace. */
export function ImportEnvironmentButton({
	workspaceId,
	canImport,
	describedBy,
}: ImportEnvironmentButtonProps) {
	const t = useT();
	const input = useRef<HTMLInputElement>(null);
	const { importFile, isPending } = useImportEnvironment(workspaceId);
	return (
		<>
			<IconButton
				size="sm"
				data-id="sidebar-envs-import"
				label={t("environments.file.import")}
				aria-describedby={describedBy}
				disabled={!canImport}
				loading={isPending}
				icon={<IconUpload size={18} aria-hidden="true" />}
				onClick={() => input.current?.click()}
			/>
			<input
				ref={input}
				type="file"
				accept=".json,application/json"
				hidden
				tabIndex={-1}
				data-id="sidebar-envs-import-file"
				aria-label={t("environments.file.import")}
				onChange={(event) => {
					const file = event.target.files?.[0];
					// Cleared, so picking the same file again still imports it.
					event.target.value = "";
					if (file) importFile(file);
				}}
			/>
		</>
	);
}
