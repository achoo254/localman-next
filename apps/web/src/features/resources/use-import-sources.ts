import { MAX_INFERENCE_BYTES } from "@localman/shared/constants";
import { useState } from "react";
import { useT } from "../../i18n/i18n-context";
import {
	type ImportFile,
	type ImportTab,
	type SourceCheck,
	checkFile,
	checkOpenApi,
	checkSample,
	fileFormat,
	kilobytes,
} from "./import-source";
import { PREVIEW_DEBOUNCE_MS } from "./use-import-preview";

type Names = Record<string, string>;

/** A file's text as UTF-8; the API flags text that was not UTF-8. */
function readText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () =>
			typeof reader.result === "string"
				? resolve(reader.result)
				: reject(new Error("Not text"));
		reader.onerror = () => reject(reader.error ?? new Error("Unreadable"));
		reader.readAsText(file, "utf-8");
	});
}

/**
 * What the user typed or chose in each tab of the import dialog. Tabs keep
 * their own source and names, so switching tabs loses nothing.
 */
export function useImportSources() {
	const t = useT();
	const [tab, setTab] = useState<ImportTab>("json");
	const [json, setJson] = useState("");
	const [jsonSyntax, setJsonSyntax] = useState<string | null>(null);
	const [openApi, setOpenApi] = useState("");
	const [openApiSyntax, setOpenApiSyntax] = useState<string | null>(null);
	const [schema, setSchema] = useState<string | null>(null);
	const [includeRelated, setIncludeRelated] = useState(true);
	const [file, setFile] = useState<ImportFile | null>(null);
	const [fileError, setFileError] = useState<string | null>(null);
	const [reading, setReading] = useState(false);
	const [names, setNames] = useState<Record<ImportTab, Names>>({
		json: {},
		openapi: {},
		file: {},
	});

	async function chooseFile(chosen: File) {
		setFile(null);
		setNames((all) => ({ ...all, file: {} }));
		const format = fileFormat(chosen.name);
		if (!format) return setFileError(t("resourceImport.errors.fileType"));
		if (chosen.size > MAX_INFERENCE_BYTES) {
			return setFileError(
				t("resourceImport.errors.tooLarge", { size: kilobytes(chosen.size) }),
			);
		}
		setFileError(null);
		setReading(true);
		try {
			const text = await readText(chosen);
			setFile({ name: chosen.name, size: chosen.size, text, format });
		} catch {
			setFileError(t("resourceImport.errors.readFailed"));
		} finally {
			setReading(false);
		}
	}

	async function chooseOpenApiFile(chosen: File) {
		if (chosen.size > MAX_INFERENCE_BYTES) {
			return setOpenApiSyntax(
				t("resourceImport.errors.tooLarge", { size: kilobytes(chosen.size) }),
			);
		}
		try {
			setOpenApi(await readText(chosen));
			setOpenApiSyntax(null);
			setSchema(null);
		} catch {
			setOpenApiSyntax(t("resourceImport.errors.readFailed"));
		}
	}

	let check: SourceCheck;
	if (tab === "json") check = checkSample(json, t, jsonSyntax);
	else if (tab === "openapi") {
		check = checkOpenApi(openApi, { schema, includeRelated }, t, openApiSyntax);
	} else {
		check = fileError ? { kind: "error", message: fileError } : checkFile(file);
	}

	return {
		tab,
		setTab,
		json: {
			text: json,
			setText: (text: string) => {
				setJson(text);
				setJsonSyntax(null);
			},
			setSyntax: setJsonSyntax,
		},
		openApi: {
			text: openApi,
			setText: (text: string) => {
				setOpenApi(text);
				setOpenApiSyntax(null);
			},
			setSyntax: setOpenApiSyntax,
			chooseFile: chooseOpenApiFile,
			schema,
			setSchema,
			includeRelated,
			setIncludeRelated,
		},
		file: {
			file,
			reading,
			choose: chooseFile,
			remove: () => {
				setFile(null);
				setFileError(null);
			},
		},
		check,
		/** A file is previewed as soon as it is read; pasted text after a pause. */
		delay: tab === "file" ? 0 : PREVIEW_DEBOUNCE_MS,
		names: names[tab],
		/** Edited names of the current tab, by resource `key`. */
		rename: (key: string, name: string) =>
			setNames((all) => ({ ...all, [tab]: { ...all[tab], [key]: name } })),
	};
}
