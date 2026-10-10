import { MAX_GENERATE_COUNT } from "@localman/shared/constants";
import {
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
	useId,
	useState,
} from "react";
import { useT } from "../../i18n/i18n-context";
import {
	GENERATOR_HEIGHT,
	GENERATOR_WIDTH,
	GeneratorGraphic,
	generatorX,
} from "./generator-graphic";

/** Arrow keys move the pending value by this many records. */
export const GENERATOR_KEY_STEP = 10;

export interface GeneratorBarProps {
	/** Records the resource holds now. */
	value: number;
	/** Accessible name, e.g. "Records of users". */
	label: string;
	/** Why the bar cannot generate now (parent without data…); null if it can. */
	blockedReason: string | null;
	onCommit: (count: number) => void;
	/** Click or Enter on a blocked bar. */
	onBlocked: () => void;
	"data-id"?: string;
	/** -1 keeps the slider out of the tab order (roving tree). */
	tabIndex?: 0 | -1;
}

const clamp = (value: number): number =>
	Math.min(MAX_GENERATE_COUNT, Math.max(0, value));

/** Count under the pointer: 0 at the left edge, 100 at the right one. */
function valueAt(element: HTMLElement, clientX: number): number {
	const rect = element.getBoundingClientRect();
	// jsdom (and a not yet laid out element) reports a zero width.
	const width = rect.width > 0 ? rect.width : GENERATOR_WIDTH;
	const x = Math.min(width, Math.max(0, clientX - rect.left));
	return Math.round((x / width) * MAX_GENERATE_COUNT);
}

/**
 * Data generator of a resource node. Hovering shows the count under the
 * pointer and a click generates exactly that many records; ←/→ (or ↓/↑)
 * move a pending value by 10, Home/End jump to 0/100, Enter generates it and
 * Escape drops the pending value. The fill eases to the new count in
 * 200ms (instant with reduced motion).
 */
export function GeneratorBar({
	value,
	label,
	blockedReason,
	onCommit,
	onBlocked,
	"data-id": dataId,
	tabIndex = 0,
}: GeneratorBarProps) {
	// SVG `url(#…)` references need a plain id; React's contains « » or :.
	const t = useT();
	const ids = `generator${useId().replace(/[^\w-]/g, "")}`;
	const [hover, setHover] = useState<number | null>(null);
	const [pending, setPending] = useState<number | null>(null);
	const blocked = blockedReason !== null;
	const shown = pending ?? value;
	const preview = blocked ? null : (hover ?? pending);

	function commit(count: number) {
		setPending(null);
		if (blocked) onBlocked();
		else onCommit(count);
	}

	function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		const base = pending ?? value;
		const moves: Record<string, number> = {
			ArrowRight: base + GENERATOR_KEY_STEP,
			ArrowUp: base + GENERATOR_KEY_STEP,
			ArrowLeft: base - GENERATOR_KEY_STEP,
			ArrowDown: base - GENERATOR_KEY_STEP,
			Home: 0,
			End: MAX_GENERATE_COUNT,
		};
		const next = moves[event.key];
		if (next !== undefined) {
			event.preventDefault();
			if (!blocked) setPending(clamp(next));
		} else if (event.key === "Enter") {
			// Enter generates the value picked with the arrows; with nothing
			// picked it does nothing, so a stray Enter never rewrites data.
			event.preventDefault();
			if (blocked) onBlocked();
			else if (pending !== null) commit(pending);
		} else if (event.key === "Escape" && pending !== null) {
			// Only swallow Escape when it cancels something here.
			event.stopPropagation();
			setPending(null);
		}
	}

	return (
		<div
			className="relative flex-none"
			style={{ width: GENERATOR_WIDTH, height: GENERATOR_HEIGHT }}
		>
			<div
				role="slider"
				tabIndex={tabIndex}
				aria-label={label}
				aria-valuemin={0}
				aria-valuemax={MAX_GENERATE_COUNT}
				aria-valuenow={shown}
				aria-valuetext={
					blockedReason === null
						? t("resourceTree.generator.value", { count: shown })
						: t("resourceTree.generator.valueBlocked", {
								count: shown,
								reason: blockedReason,
							})
				}
				aria-orientation="horizontal"
				aria-disabled={blocked || undefined}
				data-id={dataId}
				title={blockedReason ?? undefined}
				className="block size-full cursor-pointer overflow-hidden rounded-xs bg-bar-track aria-disabled:cursor-not-allowed"
				onPointerMove={(event: PointerEvent<HTMLDivElement>) =>
					setHover(valueAt(event.currentTarget, event.clientX))
				}
				onPointerLeave={() => setHover(null)}
				onClick={(event: MouseEvent<HTMLDivElement>) =>
					commit(valueAt(event.currentTarget, event.clientX))
				}
				onKeyDown={onKeyDown}
				onBlur={() => setPending(null)}
			>
				<GeneratorGraphic
					ids={ids}
					value={value}
					preview={preview}
					blocked={blocked}
				/>
			</div>
			{preview === null ? null : (
				<span
					aria-hidden="true"
					data-part="tip"
					style={{ left: generatorX(preview) }}
					className="-translate-x-1/2 pointer-events-none absolute bottom-full z-3 mb-1.5 rounded-xs bg-fg px-1.5 py-1 font-mono font-semibold text-[0.6875rem] text-surface leading-none"
				>
					{preview}
				</span>
			)}
		</div>
	);
}
