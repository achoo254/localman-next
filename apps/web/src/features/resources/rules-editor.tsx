import { MAX_RULES_PER_ENDPOINT } from "@localman/shared/endpoint-behavior";
import { IconPlus } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { type RuleDraft, ruleDraft } from "./endpoint-behavior-draft";
import type { RulePart } from "./resource-form-state";
import { RuleItem, type RuleMove } from "./rule-item";

export interface RulesEditorProps {
	rules: RuleDraft[];
	onChange: (rules: RuleDraft[]) => void;
	/** By `RuleDraft.key`. */
	errors: Record<string, Partial<Record<RulePart, string>>>;
	hasBody: boolean;
	slug: string;
	id: string;
	labelledBy: string;
}

/** Where focus goes once the list has re-rendered, by `data-id` suffix. */
interface PendingFocus {
	position: number;
	part: "source" | "toggle" | "up" | "down" | "add";
}

/**
 * Ordered rules of an endpoint: the first that matches answers. Reordered
 * with up/down buttons; moves and removals are announced politely.
 */
export function RulesEditor({
	rules,
	onChange,
	errors,
	hasBody,
	slug,
	id,
	labelledBy,
}: RulesEditorProps) {
	const t = useT();
	const root = useRef<HTMLFieldSetElement>(null);
	const [announcement, setAnnouncement] = useState("");
	const [focus, setFocus] = useState<PendingFocus | null>(null);
	const base = `resource-form-rule-${slug}`;
	const full = rules.length >= MAX_RULES_PER_ENDPOINT;

	useEffect(() => {
		if (!focus) return;
		const suffix =
			focus.part === "add"
				? `resource-form-rules-${slug}-add`
				: `${base}-${focus.position}-${focus.part}`;
		root.current?.querySelector<HTMLElement>(`[data-id="${suffix}"]`)?.focus();
		setFocus(null);
	}, [focus, base, slug]);

	function move(from: number, direction: RuleMove) {
		const to = direction === "up" ? from - 1 : from + 1;
		const next = [...rules];
		const [moved] = next.splice(from, 1);
		if (!moved) return;
		next.splice(to, 0, moved);
		onChange(next);
		const edge = to === 0 || to === rules.length - 1;
		const part = edge ? (direction === "up" ? "down" : "up") : direction;
		setFocus({ position: to + 1, part });
		setAnnouncement(
			t("resourceRules.moved", { position: to + 1, count: rules.length }),
		);
	}

	function remove(index: number) {
		const next = rules.filter((_, at) => at !== index);
		onChange(next);
		setAnnouncement(t("resourceRules.removed", { position: index + 1 }));
		if (next.length === 0) setFocus({ position: 0, part: "add" });
		else
			setFocus({
				position: Math.min(index, next.length - 1) + 1,
				part: "toggle",
			});
	}

	function add() {
		onChange([...rules, ruleDraft()]);
		setFocus({ position: rules.length + 1, part: "source" });
	}

	return (
		<fieldset
			ref={root}
			id={id}
			aria-labelledby={labelledBy}
			data-id={`resource-form-rules-${slug}`}
			className="grid gap-3 rounded-md bg-surface-subtle p-3 m-0 min-w-0 border-0"
		>
			<p className="m-0 text-[0.8125rem] text-muted">
				{t("resourceRules.intro")}
			</p>
			{rules.length === 0 ? (
				<p className="m-0 text-[0.8125rem] text-muted">
					{t("resourceRules.empty")}
				</p>
			) : (
				<ol className="m-0 grid list-none gap-2 p-0">
					{rules.map((rule, index) => (
						<RuleItem
							key={rule.key}
							rule={rule}
							position={index + 1}
							count={rules.length}
							hasBody={hasBody}
							errors={errors[rule.key]}
							base={`${base}-${index + 1}`}
							onChange={(patch) =>
								onChange(
									rules.map((r) =>
										r.key === rule.key ? { ...r, ...patch } : r,
									),
								)
							}
							onMove={(direction) => move(index, direction)}
							onRemove={() => remove(index)}
						/>
					))}
				</ol>
			)}
			<div className="flex flex-wrap items-center gap-3">
				<Button
					variant="secondary"
					size="sm"
					disabled={full}
					data-id={`resource-form-rules-${slug}-add`}
					leadingIcon={<IconPlus size={16} aria-hidden="true" />}
					onClick={add}
				>
					{t("resourceRules.add")}
				</Button>
				<span className="text-[0.8125rem] text-muted">
					{full
						? t("resourceRules.limitReached", { max: MAX_RULES_PER_ENDPOINT })
						: t("resourceRules.limit", { max: MAX_RULES_PER_ENDPOINT })}
				</span>
			</div>
			<p aria-live="polite" className="sr-only">
				{announcement}
			</p>
		</fieldset>
	);
}
