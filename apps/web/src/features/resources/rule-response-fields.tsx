import { useId } from "react";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { JsonEditor } from "../../components/ui/json-editor";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import type { RuleDraft } from "./endpoint-behavior-draft";
import type { RulePart } from "./resource-form-state";

export interface RuleResponseFieldsProps {
	rule: RuleDraft;
	errors: Partial<Record<RulePart, string>>;
	onChange: (patch: Partial<RuleDraft>) => void;
	/** "Status of rule 2" from "Status". */
	of: (field: string) => string;
	/** `resource-form-rule-{slug}-{n}`. */
	base: string;
}

const HEADERS_EXAMPLE = '{ "x-reason": "forbidden" }';

interface JsonFieldProps {
	label: string;
	accessibleName: string;
	hint: string;
	value: string;
	onChange: (value: string) => void;
	error: string | undefined;
	"data-id": string;
}

/** Optional JSON of a rule response, with its hint and error. */
function RuleJsonField({
	label,
	accessibleName,
	hint,
	value,
	onChange,
	error,
	"data-id": dataId,
}: JsonFieldProps) {
	const ids = useId();
	return (
		<div className="grid gap-1.5">
			<span className="font-mono font-semibold text-[0.8125rem]">{label}</span>
			<JsonEditor
				value={value}
				onChange={onChange}
				label={accessibleName}
				describedBy={`${ids}-hint${error ? ` ${ids}-error` : ""}`}
				invalid={Boolean(error)}
				allowEmpty
				lineWrapping
				className="min-h-14"
				data-id={dataId}
			/>
			<p id={`${ids}-hint`} className="m-0 text-[0.8125rem] text-muted">
				{renderRich(hint)}
			</p>
			{error ? (
				<p id={`${ids}-error`} className="m-0 text-[0.8125rem] text-error">
					{renderRich(error)}
				</p>
			) : null}
		</div>
	);
}

/** "Respond with": status, headers and body template of a rule. */
export function RuleResponseFields({
	rule,
	errors,
	onChange,
	of,
	base,
}: RuleResponseFieldsProps) {
	const t = useT();
	return (
		<fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0">
			<legend className="mb-2 p-0 font-mono font-semibold text-[0.8125rem]">
				{t("resourceRules.respond")}
			</legend>
			<FormField
				label={t("resourceRules.status")}
				error={errors.status}
				className="w-28"
			>
				<Input
					type="number"
					inputMode="numeric"
					min={200}
					max={599}
					aria-label={of(t("resourceRules.status"))}
					data-id={`${base}-status`}
					value={rule.status}
					onChange={(event) => onChange({ status: event.target.value })}
				/>
			</FormField>
			<RuleJsonField
				label={t("resourceRules.headers")}
				accessibleName={of(t("resourceRules.headers"))}
				hint={t("resourceRules.headersHint", { example: HEADERS_EXAMPLE })}
				value={rule.headers}
				onChange={(headers) => onChange({ headers })}
				error={errors.headers}
				data-id={`${base}-headers`}
			/>
			<RuleJsonField
				label={t("resourceRules.body")}
				accessibleName={of(t("resourceRules.body"))}
				hint={t("resourceRules.bodyHint")}
				value={rule.body}
				onChange={(body) => onChange({ body })}
				error={errors.body}
				data-id={`${base}-body`}
			/>
		</fieldset>
	);
}
