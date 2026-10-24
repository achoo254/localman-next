import type {
	ResolverLayer,
	VariableScopeKind,
} from "@localman/shared/api-client";
import type { ReactNode } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { cn } from "../../lib/cn";
import { useVaultUi } from "../environments/use-vault-ui";
import { ScopeBadge, shownValue } from "./scope-badge";
import type { ApplyVariable } from "./use-apply-variable";
import { VariableAddForm } from "./variable-add-form";
import { LockedVariableCard } from "./variable-card-locked";
import { type VariableKind, resolutionsOf } from "./variable-kinds";
import type { ScopeChoice } from "./variable-targets";

export interface VariableCardProps {
	name: string;
	kind: VariableKind;
	layers: readonly ResolverLayer[];
	choices: readonly ScopeChoice[];
	apply: ApplyVariable;
	onDone: () => void;
	/**
	 * Opens the page of the scope a withheld secret comes from, where the
	 * caller sets their local value; `null` when it cannot be opened.
	 */
	openScope?: ((kind: VariableScopeKind) => void) | null;
}

const VALUE_BOX =
	"break-all rounded-xs border border-border-subtle bg-surface-subtle px-2 py-1 font-mono text-xs";

/**
 * What a `{{name}}` resolves to: its value (secrets masked, withheld
 * ones labelled), the winning scope and the values it overrides struck
 * through; for an undeclared name, "Add to" with a scope and a value.
 */
export function VariableCard(props: VariableCardProps) {
	const t = useT();
	const vaultUi = useVaultUi() !== null;
	const { name, kind, layers } = props;
	const { winner, overridden } = resolutionsOf(layers).get(name.trim()) ?? {
		winner: null,
		overridden: [],
	};
	const head = (badge: ReactNode) => (
		<div className="flex items-center gap-2">
			<span className="min-w-0 truncate font-bold font-mono text-sm">
				{name}
			</span>
			<span className="ml-auto">{badge}</span>
		</div>
	);

	if (kind === "dynamic") {
		return (
			<div className="grid gap-2">
				{head(<ScopeBadge scope="dynamic" />)}
				<p className="m-0 text-muted text-xs">
					{t("variables.tooltip.dynamic")}
				</p>
			</div>
		);
	}

	if (!winner) {
		return (
			<div className="grid gap-2">
				{head(<Badge tone="danger">{t("variables.tooltip.undeclared")}</Badge>)}
				<p className="m-0 text-muted text-xs">
					{renderRich(
						t("variables.tooltip.undeclaredNote", { token: `{{${name}}}` }),
					)}
				</p>
				{overridden.length > 0 ? (
					<p className="m-0 text-muted text-xs">
						{t("variables.tooltip.inactiveNote")}
					</p>
				) : null}
				{name.startsWith("$") ? null : (
					<VariableAddForm
						name={name}
						choices={props.choices}
						apply={props.apply}
						onDone={props.onDone}
					/>
				)}
			</div>
		);
	}

	const scope = t(`variables.scope.${winner.kind}`);
	if (winner.locked && vaultUi) {
		return (
			<LockedVariableCard
				name={name}
				scope={winner.label ? `${scope} · ${winner.label}` : scope}
				onDone={props.onDone}
			/>
		);
	}
	const value = shownValue(winner, t);
	return (
		<div className="grid gap-2">
			{head(<ScopeBadge scope={winner.kind} />)}
			<div
				data-id="var-tooltip-current"
				className={cn(VALUE_BOX, value.muted && "text-muted italic")}
			>
				{value.text}
			</div>
			<p data-id="var-tooltip-winner" className="m-0 text-muted text-xs">
				{winner.label
					? t("variables.tooltip.fromNamed", { scope, name: winner.label })
					: t("variables.tooltip.from", { scope })}
			</p>
			{winner.withheld && props.openScope ? (
				<div>
					<Button
						size="sm"
						variant="secondary"
						data-id="var-tooltip-open-scope"
						onClick={() => props.openScope?.(winner.kind)}
					>
						{winner.label
							? t("variables.tooltip.openEnvironment", { name: winner.label })
							: t("variables.tooltip.openGlobals")}
					</Button>
				</div>
			) : null}
			{overridden.length > 0 ? (
				<div className="grid gap-1">
					<span className="text-muted text-xs">
						{t("variables.tooltip.overridden")}
					</span>
					<ul className="m-0 grid list-none gap-1 p-0">
						{overridden.map((candidate, index) => (
							<li
								// biome-ignore lint/suspicious/noArrayIndexKey: one entry per scope, never reordered.
								key={index}
								data-id="var-tooltip-overridden"
								className="flex items-center gap-2 font-mono text-muted text-xs"
							>
								<ScopeBadge scope={candidate.kind} />
								<s className="min-w-0 break-all">
									{shownValue(candidate, t).text}
								</s>
								{candidate.enabled ? null : (
									<span>{t("variables.tooltip.disabled")}</span>
								)}
							</li>
						))}
					</ul>
				</div>
			) : null}
			<p className="m-0 text-muted text-xs">
				{t("variables.tooltip.precedence")}
			</p>
		</div>
	);
}
