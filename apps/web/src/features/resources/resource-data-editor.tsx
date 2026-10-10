import { IconTextWrap } from "@tabler/icons-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { JsonEditor } from "../../components/ui/json-editor";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import {
	editorViewIn,
	labelScroller,
	revealOffset,
	setLineWrapping,
} from "./data-editor-view";
import { arrayElementOffset, recordIndexById } from "./record-position";
import { checkRecords, recordsProblem } from "./resource-records-check";
import { COMPACT_CONTROL } from "./schema-grid";

export interface ResourceDataEditorProps {
	/** Resource name, for the labels. */
	name: string;
	value: string;
	onChange: (value: string) => void;
	/** Records in the editor (the saved count while the text does not parse). */
	count: number;
	describedBy: string;
	invalid: boolean;
	onValidate: (error: string | null) => void;
}

/**
 * The records of the data modal as JSON, under a header with their count,
 * "Go to id" (moves the cursor to that record) and a line wrap switch.
 */
export function ResourceDataEditor({
	name,
	value,
	onChange,
	count,
	describedBy,
	invalid,
	onValidate,
}: ResourceDataEditorProps) {
	const t = useT();
	const ids = useId();
	const frame = useRef<HTMLDivElement>(null);
	const [wrap, setWrap] = useState(false);
	const [target, setTarget] = useState("");
	const [notFound, setNotFound] = useState<string | null>(null);
	const scrollLabel = t("resources.data.scrollLabel", { name });

	// The editor mounts first (child effects run before these).
	useEffect(() => {
		const view = editorViewIn(frame.current);
		if (view) labelScroller(view, scrollLabel);
	}, [scrollLabel]);
	useEffect(() => {
		const view = editorViewIn(frame.current);
		if (view) setLineWrapping(view, wrap);
	}, [wrap]);

	function goTo(event: FormEvent) {
		event.preventDefault();
		const id = target.trim();
		const view = editorViewIn(frame.current);
		if (id === "" || !view) return;
		const text = view.state.doc.toString();
		const { records } = checkRecords(text, t);
		if (!records) return setNotFound(t("resources.data.goToInvalid"));
		const index = recordIndexById(records, id);
		const offset = index < 0 ? null : arrayElementOffset(text, index);
		if (offset === null) {
			return setNotFound(t("resources.data.goToNotFound", { id }));
		}
		setNotFound(null);
		revealOffset(view, offset);
	}

	return (
		<div ref={frame} className="grid gap-2">
			<div
				className="flex flex-wrap items-center gap-2"
				data-id="modal-resource-data-toolbar"
			>
				<span
					className="mr-auto font-mono text-muted text-sm"
					data-id="modal-resource-data-count"
				>
					{t("resources.records", { count })}
				</span>
				<form
					onSubmit={goTo}
					className="flex items-center gap-2"
					data-id="modal-resource-data-goto"
				>
					<Input
						aria-label={t("resources.data.goToLabel")}
						placeholder={t("resources.data.goToLabel")}
						value={target}
						onChange={(event) => {
							setTarget(event.target.value);
							setNotFound(null);
						}}
						invalid={notFound !== null}
						aria-describedby={notFound ? `${ids}-goto` : undefined}
						autoComplete="off"
						spellCheck={false}
						className={cn(COMPACT_CONTROL, "w-36")}
					/>
					<Button type="submit" size="sm">
						{t("resources.data.goTo")}
					</Button>
				</form>
				<Button
					size="sm"
					variant="ghost"
					aria-pressed={wrap}
					leadingIcon={<IconTextWrap size={16} aria-hidden="true" />}
					onClick={() => setWrap((on) => !on)}
					data-id="modal-resource-data-wrap"
				>
					{t("resources.data.wrap")}
				</Button>
			</div>
			<p
				id={`${ids}-goto`}
				aria-live="polite"
				className="m-0 text-[0.8125rem] text-error empty:hidden"
				data-id="modal-resource-data-goto-error"
			>
				{notFound}
			</p>
			<JsonEditor
				value={value}
				onChange={onChange}
				label={t("resources.data.jsonLabel", { name })}
				describedBy={describedBy}
				invalid={invalid}
				validate={(parsed) => recordsProblem(parsed, t)}
				onValidate={onValidate}
				className="h-[min(60vh,28rem)]"
				data-id="modal-resource-data-json"
			/>
		</div>
	);
}
