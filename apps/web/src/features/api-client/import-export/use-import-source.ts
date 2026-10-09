import {
	type ImportedData,
	MAX_IMPORT_BYTES,
	type RequestImportResult,
	importText,
} from "@localman/shared/api-client";
import { useMemo, useState } from "react";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { readFileBytes } from "../../../platform/file-read";
import { newId } from "../workbench/workbench-ids";

export interface ChosenFile {
	name: string;
	size: number;
	text: string;
}

/** Why there is nothing to parse yet, or what parsing gave. */
export type ImportParse =
	| { state: "idle" }
	| { state: "detecting" }
	| { state: "read-failed" }
	| { state: "parsed"; result: RequestImportResult<ImportedData> };

const PARSE_DELAY_MS = 250;

/**
 * Text or file of the import dialog and its parse. Parsing runs once the
 * text stops changing (a 10 MB paste must not re-parse on every key), and
 * a file over the import cap is refused before it is read.
 */
export function useImportSource() {
	const [text, setText] = useState("");
	const [file, setFile] = useState<ChosenFile | null>(null);
	const [reading, setReading] = useState(false);
	const [readFailed, setReadFailed] = useState(false);
	const [tooLarge, setTooLarge] = useState(false);

	const source = file?.text ?? text;
	const settled = useDebouncedValue(source, PARSE_DELAY_MS);
	const result = useMemo(
		() => (settled.trim() === "" ? null : importText(settled, { newId })),
		[settled],
	);

	let parse: ImportParse;
	if (tooLarge) {
		parse = {
			state: "parsed",
			result: {
				ok: false,
				error: { code: "INPUT_TOO_LARGE", params: { max: MAX_IMPORT_BYTES } },
			},
		};
	} else if (readFailed) parse = { state: "read-failed" };
	else if (source.trim() === "") parse = { state: "idle" };
	else if (source !== settled || !result) parse = { state: "detecting" };
	else parse = { state: "parsed", result };

	const chooseFile = async (chosen: File): Promise<void> => {
		setReadFailed(false);
		setTooLarge(chosen.size > MAX_IMPORT_BYTES);
		if (chosen.size > MAX_IMPORT_BYTES) return;
		setReading(true);
		try {
			setFile({
				name: chosen.name,
				size: chosen.size,
				text: new TextDecoder().decode(await readFileBytes(chosen)),
			});
		} catch {
			setFile(null);
			setReadFailed(true);
		} finally {
			setReading(false);
		}
	};
	const changeText = (next: string): void => {
		setTooLarge(false);
		setReadFailed(false);
		setText(next);
	};
	const removeFile = (): void => {
		setFile(null);
		setTooLarge(false);
		setReadFailed(false);
	};
	const reset = (): void => {
		setText("");
		removeFile();
	};

	return {
		text,
		file,
		reading,
		parse,
		changeText,
		chooseFile,
		removeFile,
		reset,
	};
}
