/**
 * Walks the words of a `curl` command and collects what a request needs:
 * method, URLs, headers, data pieces, form parts, credentials, timeout.
 * Short options may be bundled (`-sSL`) or carry their value (`-XPOST`).
 */
import {
	type CurlParts,
	FLAG_OPTIONS,
	IGNORED_FLAGS,
	IGNORED_VALUE_OPTIONS,
	VALUE_OPTIONS,
	takesValue,
} from "./curl-option-table.js";
import type { ImportContext } from "./import-context.js";
import { paramText } from "./import-error.js";
import type { ShellWord } from "./shell-words.js";

/** Applies one option; `value` is `null` for a flag. */
function apply(
	parts: CurlParts,
	option: string,
	value: string | null,
	ctx: ImportContext,
): void {
	const handler = VALUE_OPTIONS.get(option);
	const flag = FLAG_OPTIONS.get(option);
	if (handler && value !== null) handler(parts, value, ctx);
	else if (flag) flag(parts);
	else if (IGNORED_FLAGS.has(option) || IGNORED_VALUE_OPTIONS.has(option)) {
		return;
	} else ctx.warn("UNSUPPORTED_OPTION", "", { option: paramText(option) });
}

const COMMAND_ENDS: ReadonlySet<string> = new Set(["|", "||", "&&", ";", "&"]);

/** Words after `curl`, up to the first unquoted `|`, `;` or `&&`. */
export function readCurlOptions(
	words: readonly ShellWord[],
	ctx: ImportContext,
): CurlParts {
	const parts: CurlParts = {
		method: null,
		urls: [],
		headers: [],
		data: [],
		form: [],
		user: null,
		bearer: null,
		json: false,
		get: false,
		head: false,
		timeoutSeconds: null,
	};
	let onlyUrls = false;
	for (let i = 0; i < words.length; i += 1) {
		const { text, quoted } = words[i];
		if (!quoted && COMMAND_ENDS.has(text)) break;
		if (onlyUrls || !text.startsWith("-") || text === "-") {
			parts.urls.push(text);
		} else if (text === "--") {
			onlyUrls = true;
		} else if (text.startsWith("--")) {
			const value = takesValue(text) ? (words[++i]?.text ?? "") : null;
			apply(parts, text, value, ctx);
		} else {
			for (let j = 1; j < text.length; j += 1) {
				const option = `-${text[j]}`;
				if (!takesValue(option)) {
					apply(parts, option, null, ctx);
					continue;
				}
				const rest = text.slice(j + 1);
				apply(parts, option, rest || (words[++i]?.text ?? ""), ctx);
				break;
			}
		}
	}
	return parts;
}
