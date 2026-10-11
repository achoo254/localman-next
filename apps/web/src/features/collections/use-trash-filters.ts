import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import type { TrashFilters } from "./trash-api";

/** URL query names, so a filtered Trash can be reloaded or shared. */
const PARAMS = { workspaceId: "workspace", deletedBy: "by", q: "q" } as const;

/**
 * Trash filters kept in the URL (`?workspace=&by=&q=`). The search box
 * shows what is typed at once; the URL (and the server search) follows
 * once typing pauses, and the box follows the URL on back and forward.
 */
export function useTrashFilters() {
	const [params, setParams] = useSearchParams();
	const filters: TrashFilters = {
		workspaceId: params.get(PARAMS.workspaceId) ?? "",
		deletedBy: params.get(PARAMS.deletedBy) ?? "",
		q: params.get(PARAMS.q) ?? "",
	};
	const [text, setText] = useState(filters.q);
	const settled = useDebouncedValue(text.trim(), 300);
	// The `q` this hook wrote last; any other one came from navigation.
	const written = useRef(filters.q);
	const set = (key: keyof TrashFilters, value: string) =>
		setParams(
			(current) => {
				const next = new URLSearchParams(current);
				if (value) next.set(PARAMS[key], value);
				else next.delete(PARAMS[key]);
				return next;
			},
			{ replace: true },
		);
	// biome-ignore lint/correctness/useExhaustiveDependencies: only typing moves `q`.
	useEffect(() => {
		if (settled === filters.q) return;
		written.current = settled;
		set("q", settled);
	}, [settled]);
	useEffect(() => {
		if (filters.q === written.current) return;
		written.current = filters.q;
		setText(filters.q);
	}, [filters.q]);
	return { filters, text, setText, set };
}

/**
 * A `workspace=` or `by=` value that names no workspace of the caller or
 * no one in the trash is dropped from the URL, silently.
 */
export function useDropUnknownFilters(
	{ filters, set }: Pick<ReturnType<typeof useTrashFilters>, "filters" | "set">,
	workspaceIds: readonly string[] | undefined,
	deleterIds: readonly string[] | undefined,
): void {
	const unknownWorkspace =
		workspaceIds !== undefined &&
		filters.workspaceId !== "" &&
		!workspaceIds.includes(filters.workspaceId);
	// Who deleted what is listed per workspace: judge `by=` once the
	// workspace is known to be a real one.
	const unknownDeleter =
		workspaceIds !== undefined &&
		!unknownWorkspace &&
		deleterIds !== undefined &&
		filters.deletedBy !== "" &&
		!deleterIds.includes(filters.deletedBy);
	// biome-ignore lint/correctness/useExhaustiveDependencies: `set` writes the URL only.
	useEffect(() => {
		if (unknownWorkspace) set("workspaceId", "");
		else if (unknownDeleter) set("deletedBy", "");
	}, [unknownWorkspace, unknownDeleter]);
}
