/**
 * Callbacks as the editor holds them: the target as one text
 * (`https://…` or `tunnel:<port><path>`), headers as rows, and a stable
 * key per item so errors and focus follow the right block.
 */
import {
	type CallbackEvent,
	type CallbackInput,
	type CallbackTarget,
	type CallbackView,
	HIDDEN_VALUE,
} from "./callbacks-api";
import type { Delivery } from "./delivery";

export interface HeaderDraft {
	key: string;
	name: string;
	/** As typed; empty for a hidden value the user did not replace. */
	value: string;
	/** The server keeps this value secret (`[hidden]`). */
	hidden: boolean;
}

export interface CallbackDraft {
	key: string;
	/** Kept so the server keeps the last result; absent for a new one. */
	id?: string;
	on: CallbackEvent;
	target: string;
	bodyTemplate: string;
	headers: HeaderDraft[];
	enabled: boolean;
	last: Delivery | null;
}

let counter = 0;
/** Unique key of a block or a header row within the page. */
export function nextKey(prefix: string): string {
	counter += 1;
	return `${prefix}-${counter}`;
}

export function targetText(target: CallbackTarget): string {
	return target.kind === "url"
		? target.url
		: `tunnel:${target.port}${target.path}`;
}

export function draftOf(view: CallbackView): CallbackDraft {
	return {
		key: nextKey("callback"),
		id: view.id,
		on: view.on,
		target: targetText(view.target),
		bodyTemplate: view.bodyTemplate,
		headers: view.headers.map((header) => ({
			key: nextKey("header"),
			name: header.name,
			value: header.hidden ? "" : header.value,
			hidden: header.hidden,
		})),
		enabled: view.enabled,
		last: view.last,
	};
}

export function newDraft(bodyTemplate: string): CallbackDraft {
	return {
		key: nextKey("callback"),
		on: "create",
		target: "",
		bodyTemplate,
		headers: [],
		enabled: true,
		last: null,
	};
}

export function newHeader(): HeaderDraft {
	return { key: nextKey("header"), name: "", value: "", hidden: false };
}

export type TargetParse =
	| { ok: true; target: CallbackTarget }
	| { ok: false; reason: "empty" | "http" | "format" | "port" };

const TUNNEL = /^tunnel:(\d{1,5})(\/[^\s?#]*)?$/i;

/** The target typed by the user; a tunnel without a path goes to `/`. */
export function parseTargetText(text: string): TargetParse {
	const value = text.trim();
	if (value === "") return { ok: false, reason: "empty" };
	const tunnel = TUNNEL.exec(value);
	if (tunnel) {
		const port = Number(tunnel[1]);
		if (port < 1 || port > 65_535) return { ok: false, reason: "port" };
		return {
			ok: true,
			target: { kind: "tunnel", port, path: tunnel[2] ?? "/" },
		};
	}
	if (/^http:\/\//i.test(value)) return { ok: false, reason: "http" };
	const url = /^https:\/\/\S+$/i.test(value) && URL.canParse(value);
	if (!url || new URL(value).hostname === "") {
		return { ok: false, reason: "format" };
	}
	return { ok: true, target: { kind: "url", url: value } };
}

/** Rows with neither a name nor a value are left out. */
export function filledHeaders(draft: CallbackDraft): HeaderDraft[] {
	return draft.headers.filter(
		(header) =>
			header.name.trim() !== "" || header.value !== "" || header.hidden,
	);
}

/** The request body of a draft whose target parses. */
export function inputOf(
	draft: CallbackDraft,
	target: CallbackTarget,
): CallbackInput {
	return {
		...(draft.id ? { id: draft.id } : {}),
		on: draft.on,
		target,
		bodyTemplate: draft.bodyTemplate,
		headers: filledHeaders(draft).map((header) => ({
			name: header.name.trim(),
			// Untouched hidden values go back as `[hidden]`: the server keeps them.
			value: header.hidden && header.value === "" ? HIDDEN_VALUE : header.value,
		})),
		enabled: draft.enabled,
	};
}
