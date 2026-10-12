import type { Extension } from "@codemirror/state";
import { useEffect, useMemo, useRef } from "react";
import { useVariableAssist } from "./variable-assist-context";
import {
	type ClassifierSource,
	classifierSource,
	variableHighlighter,
} from "./variable-highlighter";

/**
 * The highlighter for a CodeMirror editor of the open tab; `undefined`
 * outside a variable assist. Built once: a change of the scopes reaches
 * the editor as a state effect, so an open suggestion list stays open.
 */
export function useVariableExtension(): Extension | undefined {
	const assist = useVariableAssist();
	const classify = assist?.data.classify;
	const actions = assist?.actions;
	const source = useRef<ClassifierSource | null>(null);
	if (classify && !source.current) source.current = classifierSource(classify);

	useEffect(() => {
		if (classify) source.current?.set(classify);
	}, [classify]);

	return useMemo(() => {
		const current = source.current;
		return actions && current
			? variableHighlighter(current, actions)
			: undefined;
	}, [actions]);
}
