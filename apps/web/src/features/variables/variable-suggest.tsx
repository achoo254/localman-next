import { useEffect, useRef } from "react";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { ScopeBadge, shownValue } from "./scope-badge";
import { suggestOptionId } from "./variable-assist-context";
import type { VariableSuggestion } from "./variable-kinds";

export interface VariableSuggestProps {
	/** The editor points `aria-controls` and `aria-activedescendant` here. */
	listId: string;
	items: readonly VariableSuggestion[];
	active: number;
	onPick: (name: string) => void;
	onHover: (index: number) => void;
}

/**
 * Names offered after `{{`. Focus stays in the editor, which moves the
 * active item with ↑/↓ and picks it with Enter or Tab; the editor points
 * `aria-activedescendant` at the active option.
 */
export function VariableSuggest({
	listId,
	items,
	active,
	onPick,
	onHover,
}: VariableSuggestProps) {
	const t = useT();
	const list = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const option = list.current?.querySelector(`[data-index="${active}"]`);
		option?.scrollIntoView?.({ block: "nearest" });
	}, [active]);

	return (
		<>
			<div
				ref={list}
				id={listId}
				// biome-ignore lint/a11y/useSemanticElements: custom listbox under the caret; the editor drives it with the arrow keys and keeps focus.
				role="listbox"
				tabIndex={-1}
				aria-label={t("variables.suggest.label")}
				data-id="var-suggest"
				className="grid max-h-72 min-w-72 max-w-96 overflow-y-auto p-1"
			>
				{items.map((item, index) => {
					const preview = item.winner ? shownValue(item.winner, t).text : "";
					return (
						<div
							key={item.name}
							// biome-ignore lint/a11y/useSemanticElements: option of the custom listbox; picked by mouse here, by keyboard through the editor.
							role="option"
							tabIndex={-1}
							aria-selected={index === active}
							id={suggestOptionId(listId, index)}
							data-index={index}
							data-id="var-suggest-item"
							className={cn(
								"flex min-h-8 cursor-pointer items-center gap-2 rounded-xs px-2 font-mono text-xs",
								index === active && "bg-primary/10",
							)}
							onMouseDown={(event) => {
								// Picking on mousedown keeps focus (and the caret) in the editor.
								event.preventDefault();
								onPick(item.name);
							}}
							onMouseMove={() => onHover(index)}
						>
							<span className="min-w-0 truncate">{item.name}</span>
							<ScopeBadge scope={item.scope} />
							<span className="ml-auto max-w-32 truncate text-muted">
								{preview}
							</span>
						</div>
					);
				})}
			</div>
		</>
	);
}
