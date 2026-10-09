import { useState } from "react";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { warningText } from "./import-messages";
import type { ImportWarning } from "./resource-import-api";

const VISIBLE_NOTES = 3;

/** Notes of the preview: the first 3, the rest behind "Show all". */
export function ImportNotes({ notes }: { notes: readonly ImportWarning[] }) {
	const t = useT();
	const [all, setAll] = useState(false);
	if (notes.length === 0) return null;
	const shown = all ? notes : notes.slice(0, VISIBLE_NOTES);
	return (
		<div
			data-id="resource-import-warnings"
			className="grid gap-1 text-[0.8125rem]"
		>
			<p className="m-0 font-mono font-semibold">
				{t("resourceImport.preview.notes", { count: notes.length })}
			</p>
			<ul className="m-0 grid gap-1 pl-5 text-muted">
				{shown.map((note, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: notes of one preview never reorder.
					<li key={index}>{renderRich(warningText(note, t))}</li>
				))}
			</ul>
			{notes.length > VISIBLE_NOTES && !all ? (
				<div>
					<Button variant="ghost" size="sm" onClick={() => setAll(true)}>
						{t("resourceImport.preview.showAll", { count: notes.length })}
					</Button>
				</div>
			) : null}
		</div>
	);
}
