/** What can happen to the workbench's tabs (`workbench-reducer.ts`). */
import type { ApiRequestDraft, TabSource } from "@localman/shared/api-client";
import type { PageTab } from "./workbench-tab-types";
import type { TabResponse } from "./workbench-types";

export type WorkbenchAction =
	| {
			type: "restore";
			tabs: { id: string; draft: ApiRequestDraft; source?: TabSource }[];
	  }
	| {
			type: "open";
			id: string;
			draft: ApiRequestDraft;
			files: ReadonlyMap<string, File>;
			activate: boolean;
			redacted: boolean;
			source?: TabSource;
			saved?: ApiRequestDraft;
	  }
	| { type: "openPage"; page: PageTab }
	/** Pages remembered from an earlier visit; added without switching. */
	| { type: "restorePages"; pages: PageTab[] }
	| { type: "renamePage"; id: string; name: string }
	/** Binds (or with `null` unbinds) a tab to a collection request. */
	| {
			type: "bind";
			id: string;
			source: TabSource | null;
			saved: ApiRequestDraft | null;
	  }
	/** The bound request's draft as now stored; `dirty` follows from it. */
	| { type: "setSaved"; id: string; saved: ApiRequestDraft }
	| { type: "activate"; id: string }
	| { type: "close"; id: string }
	| {
			type: "editDraft";
			id: string;
			/** Pure: React may call it twice in development. */
			update: (draft: ApiRequestDraft) => ApiRequestDraft;
	  }
	| { type: "setFile"; id: string; fileId: string; file: File | null }
	| { type: "setResponse"; id: string; response: TabResponse }
	/** Sets (or with `null` removes) a temporary variable of the tab. */
	| { type: "setTemporary"; id: string; key: string; value: string | null };
