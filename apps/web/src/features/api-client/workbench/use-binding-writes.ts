/**
 * The collection binding (`source`) of each tab as the draft saves carry
 * it: sent when it changes, `null` to unbind a tab the server holds a
 * binding for, left out otherwise (the server keeps what it has).
 */
import type { TabSource } from "@localman/shared/api-client";
import { useMemo, useRef } from "react";
import type { SourceWrite } from "../api/draft-api";

export interface BindingWrites {
	/** A restored tab and the binding the server has for it. */
	restored: (tabId: string, source: TabSource | null) => void;
	/** The binding differs from the one last scheduled; remembers it. */
	changed: (tabId: string, source: TabSource | null) => boolean;
	/** `source` of the save about to go out (remembered as sent). */
	write: (tabId: string, source: TabSource | null) => SourceWrite;
	/** What `write` would answer, without remembering it. */
	peek: (tabId: string, source: TabSource | null) => SourceWrite;
	/** The tab closed (its draft is deleted). */
	forget: (tabId: string) => void;
}

export function useBindingWrites(): BindingWrites {
	const scheduled = useRef(new Map<string, TabSource | null>());
	const serverBound = useRef(new Set<string>());
	return useMemo<BindingWrites>(
		() => ({
			restored: (tabId, source) => {
				scheduled.current.set(tabId, source);
				if (source) serverBound.current.add(tabId);
			},
			changed: (tabId, source) => {
				const same = (scheduled.current.get(tabId) ?? null) === source;
				scheduled.current.set(tabId, source);
				return !same;
			},
			peek: (tabId, source) =>
				source ?? (serverBound.current.has(tabId) ? null : undefined),
			write: (tabId, source) => {
				const bound = serverBound.current.has(tabId);
				if (source) serverBound.current.add(tabId);
				else serverBound.current.delete(tabId);
				return source ?? (bound ? null : undefined);
			},
			forget: (tabId) => {
				scheduled.current.delete(tabId);
				serverBound.current.delete(tabId);
			},
		}),
		[],
	);
}
