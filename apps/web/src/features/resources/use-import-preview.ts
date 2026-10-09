import { useEffect, useRef, useState } from "react";
import { PreviewCache, previewKey } from "./import-preview-cache";
import {
	type ImportPreview,
	type ImportRequest,
	importResources,
} from "./resource-import-api";

export type PreviewState =
	| { status: "idle" }
	/** `previous` stays on screen, dimmed, while the new one builds. */
	| { status: "loading"; previous: ImportPreview | null }
	| { status: "ready"; preview: ImportPreview }
	| { status: "error"; error: unknown };

/** Pause after the last edit of a pasted source before the dry run. */
export const PREVIEW_DEBOUNCE_MS = 600;

/**
 * Dry run of `request` once it stops changing (`delay`, 0 for a file just
 * chosen). A newer request aborts the one in flight; the last few results
 * are kept by request, so switching back to a tab shows its preview at
 * once.
 */
export function useImportPreview(
	projectId: string,
	request: ImportRequest | null,
	delay: number,
): PreviewState {
	const [state, setState] = useState<PreviewState>({ status: "idle" });
	const cache = useRef(new PreviewCache());
	const shown = useRef<ImportPreview | null>(null);
	const key = request ? previewKey(request) : null;

	// `key` stands for `request`, a new object on every render.
	// biome-ignore lint/correctness/useExhaustiveDependencies: request is read through key.
	useEffect(() => {
		if (key === null || request === null) {
			setState({ status: "idle" });
			return;
		}
		const cached = cache.current.get(key);
		if (cached) {
			shown.current = cached;
			setState({ status: "ready", preview: cached });
			return;
		}
		setState({ status: "loading", previous: shown.current });
		const controller = new AbortController();
		const timer = window.setTimeout(() => {
			importResources(projectId, request, true, controller.signal).then(
				(preview) => {
					if (controller.signal.aborted) return;
					cache.current.set(key, preview);
					shown.current = preview;
					setState({ status: "ready", preview });
				},
				(error: unknown) => {
					if (controller.signal.aborted) return;
					shown.current = null;
					setState({ status: "error", error });
				},
			);
		}, delay);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [key, projectId, delay]);

	return state;
}
