import type {
	ApiRequestDraft,
	FormDataRow,
	KeyValueRow,
} from "@localman/shared/api-client";
import { newId } from "../workbench/workbench-ids";

/** What every request pane receives: the draft and a pure updater. */
export interface DraftPaneProps {
	draft: ApiRequestDraft;
	update: (change: (draft: ApiRequestDraft) => ApiRequestDraft) => void;
}

export function newKeyValueRow(): KeyValueRow {
	return { id: newId(), key: "", value: "", enabled: true };
}

export function newFormDataRow(): FormDataRow {
	return { ...newKeyValueRow(), kind: "text" };
}
