import { FAKER_METHOD_GROUPS } from "@localman/shared/faker-catalog";
import { IconChevronDown } from "@tabler/icons-react";
import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import { controlClassName } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

export interface FakerMethodSelectProps {
	value: string;
	onChange: (methodId: string) => void;
	/** Accessible name, e.g. "Faker method of email". */
	label: string;
	invalid?: boolean;
	"data-id"?: string;
}

interface Group {
	category: string;
	ids: string[];
}

/** Groups with the ids containing `query` (case-insensitive), empty ones dropped. */
export function filterFakerMethods(query: string): Group[] {
	const needle = query.trim().toLowerCase();
	return FAKER_METHOD_GROUPS.map((group) => ({
		category: group.category,
		ids: group.ids.filter((id) => id.toLowerCase().includes(needle)),
	})).filter((group) => group.ids.length > 0);
}

/**
 * Searchable picker over the whitelisted Faker methods (ARIA combobox with
 * a grouped listbox). Opening clears the search (the value stays as the
 * placeholder); typing filters, ↑/↓ move, Enter picks, Escape or leaving
 * the field closes without changing the value.
 */
export function FakerMethodSelect({
	value,
	onChange,
	label,
	invalid,
	"data-id": dataId,
}: FakerMethodSelectProps) {
	const t = useT();
	const listId = useId();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(0);
	// The search starts empty on open; the current value shows as placeholder.
	const groups = useMemo(
		() => filterFakerMethods(open ? query : ""),
		[open, query],
	);
	const options = useMemo(() => groups.flatMap((group) => group.ids), [groups]);
	const optionId = (index: number) => `${listId}-option-${index}`;

	// Keep the keyboard-active option in view (jsdom has no scrollIntoView).
	useEffect(() => {
		if (!open) return;
		document
			.getElementById(`${listId}-option-${active}`)
			?.scrollIntoView?.({ block: "nearest" });
	}, [open, active, listId]);

	function show() {
		if (open) return;
		const all = filterFakerMethods("").flatMap((group) => group.ids);
		setQuery("");
		setActive(Math.max(0, all.indexOf(value)));
		setOpen(true);
	}

	function pick(id: string) {
		onChange(id);
		setOpen(false);
	}

	function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (!open) return show();
			const step = event.key === "ArrowDown" ? 1 : -1;
			setActive((index) =>
				options.length === 0
					? 0
					: (index + step + options.length) % options.length,
			);
		} else if (event.key === "Enter" && open) {
			event.preventDefault();
			const id = options[active];
			if (id) pick(id);
		} else if (event.key === "Escape" && open) {
			setOpen(false);
		}
	}

	let index = -1;
	return (
		<div className="relative">
			<input
				type="text"
				role="combobox"
				aria-label={label}
				aria-expanded={open}
				aria-controls={open ? listId : undefined}
				aria-autocomplete="list"
				aria-activedescendant={
					open && options.length > 0 ? optionId(active) : undefined
				}
				aria-invalid={invalid || undefined}
				data-id={dataId}
				autoComplete="off"
				spellCheck={false}
				value={open ? query : value}
				placeholder={value}
				className={cn(controlClassName, "min-h-10 pr-8 pl-3 text-[0.8125rem]")}
				onFocus={show}
				onClick={show}
				onBlur={() => setOpen(false)}
				onChange={(event) => {
					setQuery(event.target.value);
					setActive(0);
					setOpen(true);
				}}
				onKeyDown={onKeyDown}
			/>
			<IconChevronDown
				aria-hidden="true"
				size={16}
				className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-2.5 text-icon-muted"
			/>
			{open && options.length === 0 ? (
				<output className="absolute top-full right-0 left-0 z-10 mt-1 block rounded-md border border-border bg-surface px-3 py-2 text-muted text-sm shadow-lg">
					{t("resources.schema.noMatch")}
				</output>
			) : null}
			{open && options.length > 0 ? (
				<div
					id={listId}
					// biome-ignore lint/a11y/useSemanticElements: custom listbox of the combobox; the input drives it through aria-activedescendant.
					role="listbox"
					tabIndex={-1}
					aria-label={label}
					className="absolute top-full right-0 left-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
				>
					{groups.map((group) => (
						<div
							key={group.category}
							// biome-ignore lint/a11y/useSemanticElements: option group of the custom listbox (optgroup only exists inside a native select).
							role="group"
							aria-labelledby={`${listId}-${group.category}`}
						>
							<div
								id={`${listId}-${group.category}`}
								role="presentation"
								className="px-3 pt-2 pb-1 font-mono font-semibold text-muted text-xs uppercase tracking-[0.06em]"
							>
								{group.category}
							</div>
							{group.ids.map((id) => {
								index += 1;
								const position = index;
								return (
									<div
										key={id}
										id={optionId(position)}
										// biome-ignore lint/a11y/useSemanticElements: option of the custom listbox; picked by mouse here, by keyboard through the input.
										role="option"
										tabIndex={-1}
										aria-selected={id === value}
										data-active={position === active ? "true" : undefined}
										className="cursor-pointer px-3 py-1.5 font-mono text-[0.8125rem] aria-selected:font-semibold aria-selected:text-primary data-[active=true]:bg-fg/6"
										onMouseDown={(event) => {
											// Picking on mousedown keeps focus in the input.
											event.preventDefault();
											pick(id);
										}}
										onMouseEnter={() => setActive(position)}
									>
										{id}
									</div>
								);
							})}
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}
