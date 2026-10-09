/**
 * The `curl` options the importer knows: what each one adds to the
 * request, which ones are harmless to ignore, and which ones the client
 * cannot honour (reported as warnings, never executed: `-o`, `-T`).
 */
import type { HeaderEntry } from "../request-model.js";
import type { ImportContext } from "./import-context.js";
import { paramText } from "./import-error.js";

export interface CurlFormPart {
	name: string;
	value: string;
	/** `-F name=@path`: a file the import cannot include. */
	fileName: string | null;
}

export interface CurlParts {
	method: string | null;
	urls: string[];
	headers: HeaderEntry[];
	/** `-d` pieces, sent joined with `&`. */
	data: string[];
	form: CurlFormPart[];
	user: string | null;
	bearer: string | null;
	json: boolean;
	get: boolean;
	head: boolean;
	timeoutSeconds: number | null;
}

export type ValueHandler = (
	parts: CurlParts,
	value: string,
	ctx: ImportContext,
) => void;

const header =
	(name: string): ValueHandler =>
	(parts, value) => {
		parts.headers.push({ name, value });
	};

/** `@file` means "read this file": not available to an import. */
function dataPiece(fileAware: boolean): ValueHandler {
	return (parts, value, ctx) => {
		if (fileAware && value.startsWith("@")) {
			ctx.warn("FILE_NOT_INCLUDED", "", { name: paramText(value.slice(1)) });
		} else parts.data.push(value);
	};
}

/** `content`, `=content`, `name=content`, `@file`, `name@file`. */
const urlencodePiece: ValueHandler = (parts, value, ctx) => {
	const eq = value.indexOf("=");
	const at = value.indexOf("@");
	if (eq === -1 && at !== -1) {
		ctx.warn("FILE_NOT_INCLUDED", "", { name: paramText(value.slice(at + 1)) });
	} else if (eq <= 0) {
		parts.data.push(encodeURIComponent(value.slice(eq + 1)));
	} else {
		const name = value.slice(0, eq);
		parts.data.push(`${name}=${encodeURIComponent(value.slice(eq + 1))}`);
	}
};

function formPart(literal: boolean): ValueHandler {
	return (parts, value, ctx) => {
		const eq = value.indexOf("=");
		const name = eq === -1 ? value : value.slice(0, eq);
		const content = eq === -1 ? "" : value.slice(eq + 1);
		if (!literal && content.startsWith("@")) {
			// `@path;type=…;filename=…`: only the file name is kept.
			const path = content.slice(1).split(";")[0];
			const fileName = path.split(/[\\/]/).pop() ?? path;
			parts.form.push({ name, value: "", fileName });
			ctx.warn("FILE_NOT_INCLUDED", "", { name: paramText(fileName) });
		} else if (!literal && content.startsWith("<")) {
			parts.form.push({ name, value: "", fileName: null });
			ctx.warn("FILE_NOT_INCLUDED", "", { name: paramText(content.slice(1)) });
		} else {
			parts.form.push({ name, value: content, fileName: null });
		}
	};
}

const setMethod: ValueHandler = (parts, value) => {
	parts.method = value;
};
const addUrl: ValueHandler = (parts, value) => {
	parts.urls.push(value);
};
const addHeader: ValueHandler = (parts, value) => {
	parts.headers.push(splitHeader(value));
};
const setUser: ValueHandler = (parts, value) => {
	parts.user = value;
};
const setBearer: ValueHandler = (parts, value) => {
	parts.bearer = value;
};
const addJson: ValueHandler = (parts, value, ctx) => {
	parts.json = true;
	dataPiece(true)(parts, value, ctx);
};
/** `-b name=value` is a Cookie header; `-b path` reads a cookie file. */
const addCookie: ValueHandler = (parts, value, ctx) => {
	if (value.includes("=")) parts.headers.push({ name: "Cookie", value });
	else ctx.warn("FILE_NOT_INCLUDED", "", { name: paramText(value) });
};
const setMaxTime: ValueHandler = (parts, value) => {
	parts.timeoutSeconds = Number.parseFloat(value);
};

const VALUE_OPTION_NAMES: readonly [readonly string[], ValueHandler][] = [
	[["-X", "--request"], setMethod],
	[["--url"], addUrl],
	[["-H", "--header"], addHeader],
	[["-d", "--data", "--data-ascii", "--data-binary"], dataPiece(true)],
	[["--data-raw"], dataPiece(false)],
	[["--data-urlencode"], urlencodePiece],
	[["--json"], addJson],
	[["-F", "--form"], formPart(false)],
	[["--form-string"], formPart(true)],
	[["-u", "--user"], setUser],
	[["--oauth2-bearer"], setBearer],
	[["-A", "--user-agent"], header("User-Agent")],
	[["-e", "--referer"], header("Referer")],
	[["-b", "--cookie"], addCookie],
	[["-m", "--max-time"], setMaxTime],
];

export const VALUE_OPTIONS: ReadonlyMap<string, ValueHandler> = new Map(
	VALUE_OPTION_NAMES.flatMap(([names, handler]) =>
		names.map((name) => [name, handler] as const),
	),
);

const setGet = (parts: CurlParts): void => {
	parts.get = true;
};
const setHead = (parts: CurlParts): void => {
	parts.head = true;
};
export const FLAG_OPTIONS: ReadonlyMap<string, (parts: CurlParts) => void> =
	new Map([
		["-G", setGet],
		["--get", setGet],
		["-I", setHead],
		["--head", setHead],
	]);

/** Flags that change nothing here (the client follows redirects itself…). */
export const IGNORED_FLAGS: ReadonlySet<string> = new Set(
	"-s --silent -S --show-error -L --location --location-trusted --compressed -i --include -v --verbose -g --globoff -f --fail --fail-with-body -# --progress-bar --no-progress-meter -N --no-buffer --basic --http1.0 --http1.1 --http2 --http2-prior-knowledge --http3 --tr-encoding --raw -O --remote-name -J --remote-header-name".split(
		" ",
	),
);
/** Options taking a value that change nothing here. */
export const IGNORED_VALUE_OPTIONS: ReadonlySet<string> = new Set(
	"--connect-timeout --retry --retry-delay --retry-max-time --max-redirs -D --dump-header -o --output -w --write-out -c --cookie-jar --limit-rate".split(
		" ",
	),
);
/**
 * Options taking a value that the client cannot honour: their value is
 * skipped and the option reported, like any unknown flag.
 */
const UNSUPPORTED_VALUE_OPTIONS: ReadonlySet<string> = new Set(
	"-x --proxy -U --proxy-user -T --upload-file -E --cert --key --cacert --capath --resolve --connect-to --interface -r --range".split(
		" ",
	),
);
function splitHeader(raw: string): HeaderEntry {
	// `Name;` is curl's way to send a header with an empty value.
	const colon = raw.indexOf(":");
	if (colon === -1) return { name: raw.replace(/;$/, "").trim(), value: "" };
	return {
		name: raw.slice(0, colon).trim(),
		value: raw.slice(colon + 1).trim(),
	};
}

export function takesValue(option: string): boolean {
	return (
		VALUE_OPTIONS.has(option) ||
		IGNORED_VALUE_OPTIONS.has(option) ||
		UNSUPPORTED_VALUE_OPTIONS.has(option)
	);
}
