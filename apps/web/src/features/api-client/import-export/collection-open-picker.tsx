import type { FlatImportedRequest } from "@localman/shared/api-client";
import { Button } from "../../../components/ui/button";
import { useT } from "../../../i18n/i18n-context";
import { cn } from "../../../lib/cn";
import { METHOD_TEXT_CLASS } from "../../../lib/method-tone";

export interface CollectionOpenPickerProps {
	requests: readonly FlatImportedRequest[];
	selected: ReadonlySet<string>;
	onChange: (next: Set<string>) => void;
	/** Most requests that may be picked (tabs left to open). */
	max: number;
}

/** Default pick: everything when the import is small, else nothing. */
export const AUTO_SELECT_LIMIT = 20;

export function defaultSelection(
	requests: readonly FlatImportedRequest[],
	max: number,
): Set<string> {
	if (requests.length > Math.min(AUTO_SELECT_LIMIT, max)) return new Set();
	return new Set(requests.map((request) => request.id));
}

/** Checklist of the imported requests to open as tabs. */
export function CollectionOpenPicker({
	requests,
	selected,
	onChange,
	max,
}: CollectionOpenPickerProps) {
	const t = useT();
	const full = selected.size >= max;
	const toggle = (id: string, on: boolean): void => {
		const next = new Set(selected);
		if (on) next.add(id);
		else next.delete(id);
		onChange(next);
	};
	return (
		<fieldset
			data-id="modal-import-picker"
			className="m-0 grid min-w-0 gap-2 border-0 p-0"
		>
			<legend className="mb-2 font-mono font-semibold text-[0.8125rem]">
				{t("apiClientTools.import.picker.legend")}
			</legend>
			<div className="flex flex-wrap items-center gap-2">
				<Button
					size="sm"
					data-id="modal-import-select-all"
					onClick={() =>
						onChange(new Set(requests.slice(0, max).map((r) => r.id)))
					}
				>
					{t("apiClientTools.import.picker.selectAll")}
				</Button>
				<Button
					size="sm"
					variant="ghost"
					data-id="modal-import-select-none"
					onClick={() => onChange(new Set())}
				>
					{t("apiClientTools.import.picker.selectNone")}
				</Button>
				<output className="ml-auto font-mono text-muted text-xs">
					{t("apiClientTools.import.picker.selected", {
						count: selected.size,
						total: requests.length,
					})}
				</output>
			</div>
			{requests.length > max ? (
				<p className="m-0 text-muted text-xs">
					{t("apiClientTools.import.picker.capped", { max })}
				</p>
			) : null}
			<ul className="m-0 grid max-h-64 list-none gap-0 overflow-y-auto rounded-md border border-border-subtle p-0">
				{requests.map((request) => {
					const checked = selected.has(request.id);
					return (
						<li
							key={request.id}
							className="border-border-subtle border-b last:border-b-0"
						>
							<label className="flex min-h-10 cursor-pointer items-center gap-2 px-3 py-1.5 font-mono text-xs">
								<input
									type="checkbox"
									checked={checked}
									disabled={!checked && full}
									onChange={(event) => toggle(request.id, event.target.checked)}
									className="size-4 shrink-0 accent-(--c-primary)"
								/>
								<span
									className={cn(
										"w-14 shrink-0 font-bold",
										METHOD_TEXT_CLASS[request.draft.method],
									)}
								>
									{request.draft.method}
								</span>
								<span className="min-w-0 flex-1 truncate">
									{[
										...request.folderPath,
										request.name || request.draft.url,
									].join(" / ")}
								</span>
							</label>
						</li>
					);
				})}
			</ul>
		</fieldset>
	);
}
