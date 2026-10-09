import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import {
	type RuleDraft,
	numericValue,
	opsFor,
} from "./endpoint-behavior-draft";
import { RULE_SOURCE_LIST } from "./endpoint-behavior-model";
import type { RulePart } from "./resource-form-state";
import { RuleResponseFields } from "./rule-response-fields";

export interface RuleFieldsProps {
	rule: RuleDraft;
	/** 1-based, in accessible names. */
	position: number;
	/** GET and DELETE requests have no body to match. */
	hasBody: boolean;
	errors: Partial<Record<RulePart, string>>;
	onChange: (patch: Partial<RuleDraft>) => void;
	/** `resource-form-rule-{slug}-{n}`. */
	base: string;
}

const PLACEHOLDERS = {
	header: "x-role",
	query: "role",
	body: "$.user.role",
} as const;

/** "When" (source, key, condition, value) and "Respond with" of a rule. */
export function RuleFields({
	rule,
	position,
	hasBody,
	errors,
	onChange,
	base,
}: RuleFieldsProps) {
	const t = useT();
	const of = (field: string) => t("resourceRules.fieldOf", { field, position });
	const sources = RULE_SOURCE_LIST.filter(
		(source) => hasBody || source !== "body" || rule.source === "body",
	);
	const ops = opsFor(rule.source);
	const exists = rule.source !== "nth" && rule.op === "exists";
	const rich = (text: string | undefined) =>
		text ? renderRich(text) : undefined;

	function changeSource(value: string) {
		const source = RULE_SOURCE_LIST.find((candidate) => candidate === value);
		if (!source) return;
		const op = opsFor(source).includes(rule.op) ? rule.op : "eq";
		onChange({ source, op });
	}

	return (
		<div className="grid gap-4">
			<fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
				<legend className="mb-2 p-0 font-mono font-semibold text-[0.8125rem]">
					{t("resourceRules.when")}
				</legend>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
					<FormField
						label={t("resourceRules.source")}
						className="col-span-2 sm:col-span-1"
					>
						<Select
							aria-label={of(t("resourceRules.source"))}
							data-id={`${base}-source`}
							value={rule.source}
							onChange={(event) => changeSource(event.target.value)}
						>
							{sources.map((source) => (
								<option key={source} value={source}>
									{t(`resourceRules.sources.${source}`)}
								</option>
							))}
						</Select>
					</FormField>
					{rule.source === "nth" ? null : (
						<FormField
							label={t(`resourceRules.target.${rule.source}`)}
							error={rich(errors.target)}
							className="col-span-2 sm:col-span-1"
						>
							<Input
								aria-label={of(t(`resourceRules.target.${rule.source}`))}
								data-id={`${base}-key`}
								placeholder={PLACEHOLDERS[rule.source]}
								autoComplete="off"
								spellCheck={false}
								value={rule.target}
								onChange={(event) => onChange({ target: event.target.value })}
							/>
						</FormField>
					)}
					<FormField label={t("resourceRules.op")}>
						<Select
							aria-label={of(t("resourceRules.op"))}
							data-id={`${base}-op`}
							value={rule.op}
							onChange={(event) => {
								const op = ops.find(
									(candidate) => candidate === event.target.value,
								);
								if (op) onChange({ op });
							}}
						>
							{ops.map((op) => (
								<option key={op} value={op}>
									{t(`resourceRules.ops.${op}`)}
								</option>
							))}
						</Select>
					</FormField>
					{exists ? null : (
						<FormField
							label={t("resourceRules.value")}
							error={rich(errors.value)}
						>
							<Input
								aria-label={of(t("resourceRules.value"))}
								data-id={`${base}-value`}
								inputMode={numericValue(rule) ? "numeric" : undefined}
								autoComplete="off"
								spellCheck={false}
								value={rule.value}
								onChange={(event) => onChange({ value: event.target.value })}
							/>
						</FormField>
					)}
				</div>
				{rule.source === "header" || rule.source === "nth" ? (
					<p className="m-0 text-[0.8125rem] text-muted">
						{t(
							rule.source === "nth"
								? "resourceRules.nthHint"
								: "resourceRules.headerHint",
						)}
					</p>
				) : null}
			</fieldset>
			<RuleResponseFields
				rule={rule}
				errors={errors}
				onChange={onChange}
				of={of}
				base={base}
			/>
		</div>
	);
}
