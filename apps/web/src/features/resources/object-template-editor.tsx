import { useId, useState } from "react";
import { JsonEditor } from "../../components/ui/json-editor";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { isRecord } from "../../lib/json-guards";

export interface ObjectTemplateEditorProps {
	value: string;
	onChange: (value: string) => void;
	/** Error from the last submit; replaced by the blur check while editing. */
	error: string | undefined;
}

const PLACEHOLDER = `{
  "name": "$name.fullName",
  "address": { "city": "$address.city" }
}`;

/**
 * Optional JSON object rendered once per generated record instead of the
 * schema. Open on every plan (Localman's Free plan includes it).
 */
export function ObjectTemplateEditor({
	value,
	onChange,
	error,
}: ObjectTemplateEditorProps) {
	const t = useT();
	const ids = useId();
	const mustBeObject = (parsed: unknown): string | null =>
		isRecord(parsed) ? null : t("resources.validation.templateNotObject");
	const [blurError, setBlurError] = useState<string | null>(null);
	const shown = blurError ?? error;
	return (
		<section className="grid gap-3" data-id="resource-form-template">
			<h3 id={`${ids}-label`} className="m-0 font-bold font-mono text-sm">
				Object template
			</h3>
			<JsonEditor
				value={value}
				onChange={(next) => {
					onChange(next);
					if (blurError) setBlurError(null);
				}}
				labelledBy={`${ids}-label`}
				describedBy={`${ids}-hint${shown ? ` ${ids}-error` : ""}`}
				invalid={Boolean(shown)}
				allowEmpty
				lineWrapping
				validate={mustBeObject}
				onValidate={setBlurError}
				placeholder={PLACEHOLDER}
				className="min-h-28"
				data-id="resource-form-template-json"
			/>
			<p id={`${ids}-hint`} className="m-0 text-[0.8125rem] text-muted">
				{renderRich(t("resources.template.hint"))}
			</p>
			{shown ? (
				<p id={`${ids}-error`} className="m-0 text-[0.8125rem] text-error">
					{shown}
				</p>
			) : null}
		</section>
	);
}
