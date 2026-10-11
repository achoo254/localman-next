import {
	type ExampleResponse,
	RAW_LANGUAGES,
	type RawLanguage,
} from "@localman/shared/api-client";
import { useEffect, useRef, useState } from "react";
import { CodeEditor } from "../../components/ui/code-editor";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { useT } from "../../i18n/i18n-context";
import { newKeyValueRow } from "../api-client/request/draft-pane";
import { KeyValueTable } from "../api-client/request/key-value-table";

export interface ExampleResponseFormProps {
	response: ExampleResponse;
	canEdit: boolean;
	onChange: (response: ExampleResponse) => void;
}

/** HTTP statuses an example may hold (the API takes 100–599). */
const STATUS_MIN = 100;
const STATUS_MAX = 599;

export function validExampleStatus(status: number): boolean {
	return (
		Number.isInteger(status) && status >= STATUS_MIN && status <= STATUS_MAX
	);
}

function isLanguage(value: string): value is RawLanguage {
	return RAW_LANGUAGES.some((language) => language === value);
}

/** Status, headers and body of an example (read-only for a Viewer). */
export function ExampleResponseForm({
	response,
	canEdit,
	onChange,
}: ExampleResponseFormProps) {
	const t = useT();
	const [statusText, setStatusText] = useState(String(response.status));
	const [statusError, setStatusError] = useState(false);
	// A status stored from elsewhere (reload, restore) shows unless typing.
	const editing = useRef(false);
	useEffect(() => {
		if (editing.current) return;
		setStatusText(String(response.status));
		setStatusError(false);
	}, [response.status]);
	const set = (patch: Partial<ExampleResponse>) =>
		onChange({ ...response, ...patch });
	return (
		<section aria-labelledby="example-response-title" className="grid gap-4">
			<h3 id="example-response-title" className="m-0 font-semibold text-sm">
				{t("collections.example.response")}
			</h3>
			<div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_10rem]">
				<FormField
					label={t("collections.example.status")}
					error={
						statusError ? t("collections.example.statusInvalid") : undefined
					}
				>
					<Input
						type="number"
						min={STATUS_MIN}
						max={STATUS_MAX}
						value={statusText}
						readOnly={!canEdit}
						data-id="example-status"
						onFocus={() => {
							editing.current = true;
						}}
						onBlur={() => {
							editing.current = false;
						}}
						onChange={(event) => {
							setStatusText(event.target.value);
							const status = Number(event.target.value);
							const valid = validExampleStatus(status);
							setStatusError(!valid);
							if (valid) set({ status });
						}}
					/>
				</FormField>
				<FormField label={t("collections.example.statusText")}>
					<Input
						value={response.statusText}
						maxLength={200}
						readOnly={!canEdit}
						data-id="example-status-text"
						onChange={(event) => set({ statusText: event.target.value })}
					/>
				</FormField>
				<FormField label={t("collections.example.language")}>
					<Select
						value={response.bodyLanguage}
						disabled={!canEdit}
						data-id="example-language"
						onChange={(event) => {
							const value = event.target.value;
							if (isLanguage(value)) set({ bodyLanguage: value });
						}}
					>
						{RAW_LANGUAGES.map((language) => (
							<option key={language} value={language}>
								{language.toUpperCase()}
							</option>
						))}
					</Select>
				</FormField>
			</div>
			{canEdit ? (
				<KeyValueTable
					rows={response.headers}
					onChange={(headers) => set({ headers })}
					createRow={newKeyValueRow}
					dataId="example-headers"
					caption={t("collections.example.headers")}
					addLabel={t("collections.example.addHeader")}
				/>
			) : (
				<dl
					data-id="example-headers"
					className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-xs"
				>
					{response.headers.map((header) => (
						<div key={header.id} className="contents">
							<dt className="font-semibold">{header.key}</dt>
							<dd className="m-0 break-all">{header.value}</dd>
						</div>
					))}
				</dl>
			)}
			<CodeEditor
				value={response.body}
				language={response.bodyLanguage}
				readOnly={!canEdit}
				lineNumbers
				label={t("collections.example.body")}
				className="min-h-56"
				data-id="example-body"
				onChange={(body) => set({ body })}
			/>
		</section>
	);
}
