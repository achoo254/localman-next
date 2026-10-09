import { MAX_CHAOS_DELAY_MS } from "@localman/shared/endpoint-behavior";
import { type ComponentProps, useId } from "react";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import {
	CHAOS_STATUSES,
	type ChaosDraft,
	NO_CHAOS,
} from "./endpoint-behavior-draft";
import type { ChaosPart } from "./resource-form-state";

export interface ChaosPanelProps {
	chaos: ChaosDraft;
	onChange: (chaos: ChaosDraft) => void;
	errors: Partial<Record<ChaosPart, string>>;
	/** `resource-form-chaos-{slug}-…` ids. */
	slug: string;
	id: string;
	labelledBy: string;
}

/** Number input with a unit drawn inside it; the unit is in the label. */
function UnitInput({
	unit,
	...rest
}: ComponentProps<typeof Input> & { unit: string }) {
	return (
		<div className="relative">
			<Input type="number" inputMode="decimal" className="pr-10" {...rest} />
			<span
				aria-hidden="true"
				className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 font-mono text-muted text-xs"
			>
				{unit}
			</span>
		</div>
	);
}

const RATES = [
	["errorRate", "errorRateLabel", "errorRateHint", "error-rate"],
	["rateLimitRate", "rateLimitRateLabel", "rateLimitHint", "rate-limit-rate"],
	["timeoutRate", "timeoutRateLabel", "timeoutHint", "timeout-rate"],
] as const;

/**
 * Chaos of one endpoint: a random delay, then error, 429 and timeout
 * rates (in percent here, 0–1 in the API). Saved with the resource form.
 */
export function ChaosPanel({
	chaos,
	onChange,
	errors,
	slug,
	id,
	labelledBy,
}: ChaosPanelProps) {
	const t = useT();
	const ratesErrorId = useId();
	const base = `resource-form-chaos-${slug}`;
	const set = (patch: Partial<ChaosDraft>) => onChange({ ...chaos, ...patch });
	const status = Number(chaos.errorStatus);
	const statuses = CHAOS_STATUSES.some(([code]) => code === status)
		? CHAOS_STATUSES
		: [...CHAOS_STATUSES, [status, ""] as const];

	return (
		<fieldset
			id={id}
			aria-labelledby={labelledBy}
			data-id={base}
			className="grid gap-4 rounded-md bg-surface-subtle p-3 m-0 min-w-0 border-0"
		>
			<p className="m-0 text-[0.8125rem] text-muted">
				{t("resourceChaos.intro")} {t("resourceChaos.order")}
			</p>
			<div className="grid gap-4 sm:grid-cols-2">
				<fieldset className="m-0 grid min-w-0 gap-1.5 border-0 p-0">
					<legend className="mb-1.5 p-0 font-mono font-semibold text-[0.8125rem] text-fg">
						{t("resourceChaos.delay")}
					</legend>
					<div className="grid grid-cols-2 gap-2">
						{(["min", "max"] as const).map((part) => (
							<FormField
								key={part}
								label={t(`resourceChaos.${part}`)}
								error={errors[part]}
							>
								<UnitInput
									unit="ms"
									inputMode="numeric"
									min={0}
									max={MAX_CHAOS_DELAY_MS}
									step={1}
									aria-label={t(`resourceChaos.${part}Label`)}
									data-id={`${base}-delay-${part}`}
									value={chaos[part]}
									onChange={(event) => set({ [part]: event.target.value })}
								/>
							</FormField>
						))}
					</div>
					<p className="m-0 text-[0.8125rem] text-muted">
						{t("resourceChaos.delayHint", { max: MAX_CHAOS_DELAY_MS })}
					</p>
				</fieldset>
				<FormField label={t("resourceChaos.errorStatus")}>
					<Select
						data-id={`${base}-error-status`}
						value={chaos.errorStatus}
						onChange={(event) => set({ errorStatus: event.target.value })}
					>
						{statuses.map(([code, phrase]) => (
							<option key={code} value={String(code)}>
								{phrase ? `${code} ${phrase}` : code}
							</option>
						))}
					</Select>
				</FormField>
				{RATES.map(([part, label, hint, dataId]) => (
					<FormField
						key={part}
						label={t(`resourceChaos.${part}`)}
						hint={renderRich(t(`resourceChaos.${hint}`))}
						error={errors[part]}
					>
						<UnitInput
							unit="%"
							min={0}
							max={100}
							step={1}
							aria-label={t(`resourceChaos.${label}`)}
							invalid={Boolean(errors[part] ?? errors.rates)}
							aria-describedby={errors.rates ? ratesErrorId : undefined}
							data-id={`${base}-${dataId}`}
							value={chaos[part]}
							onChange={(event) => set({ [part]: event.target.value })}
						/>
					</FormField>
				))}
			</div>
			{errors.rates ? (
				<p id={ratesErrorId} className="m-0 text-error text-xs">
					{errors.rates}
				</p>
			) : null}
			<div>
				<Button
					variant="ghost"
					size="sm"
					data-id={`${base}-off`}
					onClick={() => onChange(NO_CHAOS)}
				>
					{t("resourceChaos.off")}
				</Button>
			</div>
		</fieldset>
	);
}
