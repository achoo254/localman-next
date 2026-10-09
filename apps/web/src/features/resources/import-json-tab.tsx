import { MAX_RECORDS_PER_RESOURCE } from "@localman/shared/constants";
import { useId } from "react";
import { JsonEditor } from "../../components/ui/json-editor";
import { useT } from "../../i18n/i18n-context";
import type { useImportSources } from "./use-import-sources";

export interface ImportJsonTabProps {
	source: ReturnType<typeof useImportSources>["json"];
	errorId: string | undefined;
}

const PLACEHOLDER = '[{ "name": "Ada", "email": "ada@example.com" }]';

/** Sample JSON tab: one object or an array of objects becomes the records. */
export function ImportJsonTab({ source, errorId }: ImportJsonTabProps) {
	const t = useT();
	const ids = useId();
	return (
		<div className="grid gap-3" data-id="resource-import-json">
			<span
				id={`${ids}-label`}
				className="font-mono font-semibold text-[0.8125rem]"
			>
				{t("resourceImport.json.label")}
			</span>
			<JsonEditor
				value={source.text}
				onChange={source.setText}
				onValidate={source.setSyntax}
				labelledBy={`${ids}-label`}
				describedBy={[`${ids}-hint`, errorId].filter(Boolean).join(" ")}
				invalid={Boolean(errorId)}
				placeholder={PLACEHOLDER}
				allowEmpty
				lineWrapping
				className="min-h-40 md:min-h-56"
			/>
			<p id={`${ids}-hint`} className="m-0 text-[0.8125rem] text-muted">
				{t("resourceImport.json.hint", { max: MAX_RECORDS_PER_RESOURCE })}
			</p>
		</div>
	);
}
