import type { VariableEntry } from "@localman/shared/api-client";
import { useState } from "react";
import { controlClassName } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

export interface LocalValueCellProps {
	entry: VariableEntry;
	/** The variable's name, or its row for one without a key yet. */
	label: string;
	/** The caller's value, `null` when they use the shared one. */
	value: string | null;
	ready: boolean;
	className: string;
	/** `null` (an emptied box) goes back to the shared value. */
	onSave: (value: string | null) => void;
}

/**
 * The caller's own value of a collection variable, saved when the box
 * loses focus. Empty means "use the shared value", shown as placeholder
 * unless the variable is secret. Once typing starts the box keeps what is
 * typed (a value the server answers meanwhile shows after it is left).
 */
export function LocalValueCell(props: LocalValueCellProps) {
	const t = useT();
	const { entry, value } = props;
	const [draft, setDraft] = useState<string | null>(null);
	const key = entry.key.trim();
	return (
		<td className={props.className}>
			<input
				type={entry.secret ? "password" : "text"}
				autoComplete="off"
				value={draft ?? value ?? ""}
				placeholder={entry.secret ? undefined : entry.value}
				disabled={!props.ready || key === ""}
				data-id="collection-variable-local"
				aria-label={t("environments.table.localOf", { name: props.label })}
				className={cn(controlClassName, "min-h-9 px-2 text-xs")}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => {
					setDraft(null);
					if (draft === null || draft === (value ?? "")) return;
					props.onSave(draft === "" ? null : draft);
				}}
			/>
		</td>
	);
}
