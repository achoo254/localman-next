import { COLLECTION_NAME_MAX } from "@localman/shared/api-client";
import { useEffect, useRef } from "react";
import { controlClassName } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

export interface RenameInputProps {
	name: string;
	/**
	 * The new name, or `null` when cancelled or unchanged; `byKey` when
	 * Enter or Escape ended it (focus goes back to the row then).
	 */
	onDone: (name: string | null, byKey: boolean) => void;
}

/** In-place rename of a tree row: Enter or leaving saves, Escape cancels. */
export function RenameInput({ name, onDone }: RenameInputProps) {
	const t = useT();
	const ref = useRef<HTMLInputElement>(null);
	const done = useRef(false);
	useEffect(() => {
		ref.current?.focus();
		ref.current?.select();
	}, []);

	const finish = (save: boolean, byKey: boolean): void => {
		if (done.current) return;
		done.current = true;
		const next = ref.current?.value.trim() ?? "";
		onDone(save && next !== "" && next !== name ? next : null, byKey);
	};

	return (
		<input
			ref={ref}
			defaultValue={name}
			maxLength={COLLECTION_NAME_MAX}
			aria-label={t("collections.row.rename", { name })}
			data-id="sidebar-tree-rename-input"
			className={cn(controlClassName, "min-h-6 min-w-0 flex-1 px-1.5 text-xs")}
			onClick={(event) => event.stopPropagation()}
			onKeyDown={(event) => {
				event.stopPropagation();
				if (event.key === "Enter") {
					event.preventDefault();
					finish(true, true);
				} else if (event.key === "Escape") {
					event.preventDefault();
					finish(false, true);
				}
			}}
			onBlur={() => finish(true, false)}
		/>
	);
}
