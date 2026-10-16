import {
	BODY_TYPES,
	type BodyType,
	RAW_LANGUAGES,
	type RawLanguage,
	type RequestBody,
} from "@localman/shared/api-client";
import { CodeEditor } from "../../../components/ui/code-editor";
import { useT } from "../../../i18n/i18n-context";
import { useVariableExtension } from "../../variables/use-variable-extension";
import { FilePicker } from "./body-binary-picker";
import type { BodyFilesProps } from "./body-files";
import { BodyFormTable } from "./body-form-table";
import type { DraftPaneProps } from "./draft-pane";
import { newKeyValueRow } from "./draft-pane";
import { useInlineCommenting } from "./inline-comment-context";
import { KeyValueTable } from "./key-value-table";

function isRawLanguage(value: string): value is RawLanguage {
	return RAW_LANGUAGES.some((language) => language === value);
}

/** Body of the request in one of five forms; each keeps its content when switching. */
export function BodyTab({
	draft,
	update,
	files,
	setFile,
}: DraftPaneProps & BodyFilesProps) {
	const t = useT();
	const variables = useVariableExtension();
	const anchors = useInlineCommenting()?.codeExtension("body");
	const { body } = draft;
	const setBody = (change: Partial<RequestBody>) =>
		update((current) => ({ ...current, body: { ...current.body, ...change } }));
	const ignored =
		(draft.method === "GET" || draft.method === "HEAD") && body.type !== "none";

	return (
		<div className="grid gap-3">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<fieldset className="m-0 flex flex-wrap gap-x-4 gap-y-2 border-0 p-0">
					<legend className="sr-only">{t("apiClient.body.type")}</legend>
					{BODY_TYPES.map((type: BodyType) => (
						<label
							key={type}
							className="inline-flex min-h-9 cursor-pointer items-center gap-2 font-mono text-sm"
						>
							<input
								type="radio"
								name="request-body-type"
								value={type}
								checked={body.type === type}
								className="size-4 accent-primary"
								data-id={`request-body-type-${type}`}
								onChange={() => setBody({ type })}
							/>
							{t(`apiClient.body.types.${type}`)}
						</label>
					))}
				</fieldset>
				{body.type === "raw" ? (
					<select
						value={body.rawLanguage}
						aria-label={t("apiClient.body.rawLanguage")}
						data-id="request-body-raw-lang"
						className="min-h-9 rounded-sm border border-border bg-surface px-2 font-mono text-sm"
						onChange={(event) => {
							const language = event.target.value;
							if (isRawLanguage(language)) setBody({ rawLanguage: language });
						}}
					>
						{RAW_LANGUAGES.map((language) => (
							<option key={language} value={language}>
								{language.toUpperCase()}
							</option>
						))}
					</select>
				) : null}
			</div>
			{ignored ? (
				<p className="text-warning-text text-xs">
					{t("apiClient.body.ignored", { method: draft.method })}
				</p>
			) : null}
			{body.type === "none" ? (
				<p className="text-muted text-sm">{t("apiClient.body.none")}</p>
			) : null}
			{body.type === "raw" ? (
				<div data-id="request-body-raw" data-comment-part="body">
					<CodeEditor
						value={body.raw}
						language={body.rawLanguage}
						label={t("apiClient.body.rawLabel")}
						lineNumbers
						className="min-h-48"
						data-id="request-body-editor"
						extensions={anchors ? [variables ?? [], anchors] : variables}
						onChange={(raw) => setBody({ raw })}
					/>
				</div>
			) : null}
			{body.type === "urlencoded" ? (
				<KeyValueTable
					rows={body.urlencoded}
					onChange={(urlencoded) => setBody({ urlencoded })}
					createRow={newKeyValueRow}
					dataId="request-body"
					tableDataId="request-body-urlencoded"
					caption={t("apiClient.body.types.urlencoded")}
					addLabel={t("apiClient.body.addRow")}
				/>
			) : null}
			{body.type === "formdata" ? (
				<BodyFormTable
					rows={body.formData}
					onChange={(formData) => setBody({ formData })}
					files={files}
					setFile={setFile}
				/>
			) : null}
			{body.type === "binary" ? (
				<div className="grid gap-2">
					<FilePicker
						value={body.binary}
						hasBytes={body.binary ? files.has(body.binary.fileId) : false}
						label={t("apiClient.body.binaryLabel")}
						data-id="request-body-binary"
						onPick={(ref, file) => {
							if (body.binary) setFile(body.binary.fileId, null);
							setFile(ref.fileId, file);
							setBody({ binary: ref });
						}}
					/>
					<p className="text-muted text-xs">{t("apiClient.body.binaryHint")}</p>
				</div>
			) : null}
		</div>
	);
}
