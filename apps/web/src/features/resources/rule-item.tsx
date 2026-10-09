import {
	IconArrowDown,
	IconArrowUp,
	IconChevronRight,
	IconX,
} from "@tabler/icons-react";
import { IconButton } from "../../components/ui/icon-button";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { ruleSummary } from "./behavior-summary";
import type { RuleDraft } from "./endpoint-behavior-draft";
import type { RulePart } from "./resource-form-state";
import { RuleFields } from "./rule-fields";

export type RuleMove = "up" | "down";

export interface RuleItemProps {
	rule: RuleDraft;
	position: number;
	count: number;
	hasBody: boolean;
	errors: Partial<Record<RulePart, string>> | undefined;
	/** `resource-form-rule-{slug}-{n}`. */
	base: string;
	onChange: (patch: Partial<RuleDraft>) => void;
	onMove: (move: RuleMove) => void;
	onRemove: () => void;
}

/**
 * One rule: a summary row (expands the rule, moves it, removes it), then
 * its fields while open. Collapsed rules mount no JSON editor.
 */
export function RuleItem({
	rule,
	position,
	count,
	hasBody,
	errors,
	base,
	onChange,
	onMove,
	onRemove,
}: RuleItemProps) {
	const t = useT();
	const summary = ruleSummary(rule, t) ?? t("resourceRules.incomplete");
	const invalid = errors !== undefined && Object.keys(errors).length > 0;
	const panelId = `${base}-fields`;
	return (
		<li
			data-id={base}
			className={cn(
				"grid gap-3 rounded-md border bg-surface p-2",
				invalid && !rule.open ? "border-error" : "border-border-subtle",
			)}
		>
			<div className="flex items-center gap-1">
				<button
					type="button"
					aria-expanded={rule.open}
					aria-controls={rule.open ? panelId : undefined}
					aria-label={t("resourceRules.toggleRule", { position, summary })}
					data-id={`${base}-toggle`}
					className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-1 text-left text-fg hover:bg-fg/6 pointer-coarse:min-h-11"
					onClick={() => onChange({ open: !rule.open })}
				>
					<IconChevronRight
						size={16}
						aria-hidden="true"
						className={cn(
							"shrink-0 text-icon-muted transition-transform motion-reduce:transition-none",
							rule.open && "rotate-90",
						)}
					/>
					<span className="font-mono font-semibold text-muted text-xs">
						{position}
					</span>
					<span className="truncate font-mono text-[0.8125rem]">{summary}</span>
					{invalid && !rule.open ? (
						<span className="shrink-0 text-error text-xs">
							{t("resourceRules.checkRule")}
						</span>
					) : null}
				</button>
				<IconButton
					size="sm"
					label={t("resourceRules.moveUp", { position })}
					icon={<IconArrowUp size={16} aria-hidden="true" />}
					disabled={position === 1}
					data-id={`${base}-up`}
					onClick={() => onMove("up")}
				/>
				<IconButton
					size="sm"
					label={t("resourceRules.moveDown", { position })}
					icon={<IconArrowDown size={16} aria-hidden="true" />}
					disabled={position === count}
					data-id={`${base}-down`}
					onClick={() => onMove("down")}
				/>
				<IconButton
					size="sm"
					label={t("resourceRules.remove", { position })}
					icon={<IconX size={16} aria-hidden="true" />}
					data-id={`${base}-remove`}
					onClick={onRemove}
				/>
			</div>
			{rule.open ? (
				<div id={panelId} className="px-1 pb-1">
					<RuleFields
						rule={rule}
						position={position}
						hasBody={hasBody}
						errors={errors ?? {}}
						onChange={onChange}
						base={base}
					/>
				</div>
			) : null}
		</li>
	);
}
