import { useId, useState } from "react";
import { JsonEditor } from "../../components/ui/json-editor";
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

const mustBeObject = (value: unknown): string | null =>
	isRecord(value) ? null : "Object template phải là một object JSON.";

/**
 * Optional JSON object rendered once per generated record instead of the
 * schema. Open on every plan (Localman's Free plan includes it).
 */
export function ObjectTemplateEditor({
	value,
	onChange,
	error,
}: ObjectTemplateEditorProps) {
	const ids = useId();
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
				Template JSON thay cho schema ở trên, dùng cho cấu trúc lồng phức tạp.
				Giá trị dạng <code>"$category.method"</code> gọi Faker (ví dụ{" "}
				<code>"$internet.email"</code>). Để trống để dùng schema.
			</p>
			{shown ? (
				<p id={`${ids}-error`} className="m-0 text-[0.8125rem] text-error">
					{shown}
				</p>
			) : null}
		</section>
	);
}
