import { IconFileImport } from "@tabler/icons-react";
import { useId, useRef } from "react";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { JsonEditor } from "../../components/ui/json-editor";
import { Select } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import type { ImportPreview } from "./resource-import-api";
import type { useImportSources } from "./use-import-sources";

export interface ImportOpenApiTabProps {
	source: ReturnType<typeof useImportSources>["openApi"];
	/** Last preview of this tab: its schema list and related count. */
	preview: ImportPreview | null;
	errorId: string | undefined;
}

/** OpenAPI tab: the document (pasted or from a file), its schema, related. */
export function ImportOpenApiTab({
	source,
	preview,
	errorId,
}: ImportOpenApiTabProps) {
	const t = useT();
	const ids = useId();
	const fileInput = useRef<HTMLInputElement>(null);
	const schemaNames = preview?.schemaNames ?? [];
	const showRelated =
		(preview?.relatedCount ?? 0) > 0 || !source.includeRelated;
	return (
		<div className="grid gap-3" data-id="resource-import-openapi">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<span
					id={`${ids}-label`}
					className="font-mono font-semibold text-[0.8125rem]"
				>
					{t("resourceImport.openapi.label")}
				</span>
				<Button
					size="sm"
					data-id="resource-import-openapi-file"
					leadingIcon={<IconFileImport size={16} aria-hidden="true" />}
					onClick={() => fileInput.current?.click()}
				>
					{t("resourceImport.openapi.chooseFile")}
				</Button>
				<input
					ref={fileInput}
					type="file"
					accept=".json,application/json"
					hidden
					tabIndex={-1}
					onChange={(event) => {
						const [chosen] = event.target.files ?? [];
						if (chosen) void source.chooseFile(chosen);
						event.target.value = "";
					}}
				/>
			</div>
			<JsonEditor
				value={source.text}
				onChange={source.setText}
				onValidate={source.setSyntax}
				labelledBy={`${ids}-label`}
				describedBy={[`${ids}-hint`, errorId].filter(Boolean).join(" ")}
				invalid={Boolean(errorId)}
				allowEmpty
				lineWrapping
				className="min-h-40 md:min-h-56"
			/>
			<p id={`${ids}-hint`} className="m-0 text-[0.8125rem] text-muted">
				{renderRich(t("resourceImport.openapi.hint"))}
			</p>
			{schemaNames.length >= 2 ? (
				<FormField
					label={t("resourceImport.openapi.schema")}
					hint={renderRich(
						t("resourceImport.openapi.schemaHint", {
							count: schemaNames.length,
						}),
					)}
				>
					<Select
						data-id="resource-import-openapi-schema"
						value={source.schema ?? preview?.selectedSchema ?? ""}
						onChange={(event) => source.setSchema(event.target.value)}
					>
						{schemaNames.map((name) => (
							<option key={name} value={name}>
								{name}
							</option>
						))}
					</Select>
				</FormField>
			) : null}
			{showRelated ? (
				<div className="flex items-start gap-3">
					<Switch
						checked={source.includeRelated}
						onCheckedChange={source.setIncludeRelated}
						aria-labelledby={`${ids}-related`}
						aria-describedby={`${ids}-related-hint`}
						data-id="resource-import-related"
						className="mt-0.5"
					/>
					<div className="grid gap-0.5 text-[0.8125rem]">
						<span id={`${ids}-related`} className="font-semibold">
							{t("resourceImport.openapi.related")}
						</span>
						<span id={`${ids}-related-hint`} className="text-muted">
							{renderRich(
								t(
									source.includeRelated
										? "resourceImport.openapi.relatedOn"
										: "resourceImport.openapi.relatedOff",
								),
							)}
						</span>
					</div>
				</div>
			) : null}
		</div>
	);
}
