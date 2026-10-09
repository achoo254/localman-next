import { IconPlus, IconSend } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import { useT } from "../../../i18n/i18n-context";

export interface EmptyEditorProps {
	onNew: () => void;
	canOpen: boolean;
	/** More ways to start (import, from a mock project). */
	actions?: ReactNode;
}

/** Shown when no tab is open. */
export function EmptyEditor({ onNew, canOpen, actions }: EmptyEditorProps) {
	const t = useT();
	return (
		<div
			data-id="editor-empty"
			className="grid place-items-center content-center gap-3 px-6 py-12 text-center"
		>
			<IconSend size={32} aria-hidden="true" className="text-icon-muted" />
			<h2 className="font-bold font-mono text-base">
				{t("apiClient.empty.title")}
			</h2>
			<p className="max-w-md text-muted text-sm">{t("apiClient.empty.body")}</p>
			<div className="flex flex-wrap justify-center gap-2">
				<Button data-id="editor-empty-new" disabled={!canOpen} onClick={onNew}>
					<IconPlus size={16} aria-hidden="true" />
					{t("apiClient.empty.new")}
				</Button>
				{actions}
			</div>
		</div>
	);
}
