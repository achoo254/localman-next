import { type Ref, useId } from "react";
import { CodeEditor } from "../../components/ui/code-editor";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { useT } from "../../i18n/i18n-context";
import {
	CONTENT_TYPES,
	type InboxDraft,
	type InboxErrors,
	MAX_STATUS,
	MIN_STATUS,
	bodyLanguage,
} from "./inbox-form-state";

export interface InboxResponseFieldsProps {
	draft: InboxDraft;
	errors: InboxErrors;
	onChange: <K extends keyof InboxDraft>(
		field: K,
		value: InboxDraft[K],
	) => void;
	/** Set on the status field when it is the first one to fill (edit). */
	statusRef?: Ref<HTMLInputElement>;
}

/** "Response to the sender": status, Content-Type and body. */
export function InboxResponseFields({
	draft,
	errors,
	onChange,
	statusRef,
}: InboxResponseFieldsProps) {
	const t = useT();
	const bodyId = useId();
	return (
		<section className="grid gap-3" data-id="inbox-form-response">
			<h3 className="m-0 font-bold font-mono text-sm">
				{t("webhookInbox.form.responseTitle")}
			</h3>
			<div className="grid gap-3 sm:grid-cols-2">
				<FormField label={t("webhookInbox.form.status")} error={errors.status}>
					<Input
						ref={statusRef}
						type="number"
						inputMode="numeric"
						min={MIN_STATUS}
						max={MAX_STATUS}
						value={draft.status}
						onChange={(event) => onChange("status", event.target.value)}
						data-id="inbox-form-status"
					/>
				</FormField>
				<FormField label={t("webhookInbox.form.contentType")}>
					<Select
						value={draft.contentType}
						onChange={(event) => onChange("contentType", event.target.value)}
						data-id="inbox-form-content-type"
					>
						{CONTENT_TYPES.map((type) => (
							<option key={type} value={type}>
								{type}
							</option>
						))}
					</Select>
				</FormField>
			</div>
			<div className="grid gap-1.5">
				<span
					id={`${bodyId}-label`}
					className="font-mono font-semibold text-[0.8125rem] text-fg"
				>
					{t("webhookInbox.form.body")}
				</span>
				<CodeEditor
					value={draft.body}
					onChange={(body) => onChange("body", body)}
					language={bodyLanguage(draft.contentType)}
					labelledBy={`${bodyId}-label`}
					describedBy={errors.body ? `${bodyId}-error` : undefined}
					className="min-h-24"
					data-id="inbox-form-body"
				/>
				{errors.body ? (
					<p id={`${bodyId}-error`} className="m-0 text-[0.8125rem] text-error">
						{errors.body}
					</p>
				) : null}
			</div>
		</section>
	);
}
