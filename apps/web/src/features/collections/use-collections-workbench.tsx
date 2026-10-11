/**
 * What collections add to the workbench while the workspaces flag is on:
 * collection and folder pages, the breadcrumb and Save of bound requests,
 * the inherited-auth note, Ctrl/Cmd+S and the "Save to collection"
 * dialog. Off, every part is absent and the workbench behaves as before.
 */
import type { CollectionDetail } from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useRef, useState } from "react";
import {
	AuthInheritContext,
	type InheritNoteOf,
} from "../api-client/request/auth-inherit-context";
import {
	useWorkbenchActions,
	useWorkbenchState,
} from "../api-client/workbench/workbench-context";
import type { PageTab } from "../api-client/workbench/workbench-tab-types";
import type { WorkbenchTab } from "../api-client/workbench/workbench-types";
import { BoundSavedSync } from "./bound-saved-sync";
import { CollectionPage } from "./collection-page";
import { InheritSourceNote } from "./inherit-source-note";
import { type OpenNode, useOpenCollectionNode } from "./open-node";
import { PageSaveContext, type RegisterPageSave } from "./page-save-context";
import { RequestBreadcrumb } from "./request-breadcrumb";
import { SaveRequestButton } from "./save-request-button";
import { SaveToCollectionModal } from "./save-to-collection-modal";
import { collectionKey } from "./use-collections";
import { useRequestSave } from "./use-request-save";

export interface CollectionsWorkbench {
	openNode: OpenNode;
	onSave?: (tabId: string | null) => boolean;
	renderPage?: (page: PageTab) => ReactNode;
	renderAboveRequest?: (tab: WorkbenchTab) => ReactNode;
	saveButton: (tab: WorkbenchTab) => ReactNode;
	/** Wraps the workbench with the contexts pages and the auth pane read. */
	wrap: (children: ReactNode) => ReactNode;
	/** The save dialog and the restored-tab sync. */
	extras: ReactNode;
}

export function useCollectionsWorkbench(
	enabled: boolean,
): CollectionsWorkbench {
	const openNode = useOpenCollectionNode();
	const client = useQueryClient();
	const { currentTabs } = useWorkbenchActions();
	const { tabs } = useWorkbenchState();
	const [askTabId, setAskTabId] = useState<string | null>(null);
	const saveRequest = useRequestSave(setAskTabId);
	const pageSaves = useRef(new Map<string, () => void>());

	const registerPageSave = useCallback<RegisterPageSave>((pageId, flush) => {
		if (flush) pageSaves.current.set(pageId, flush);
		else pageSaves.current.delete(pageId);
	}, []);
	const onSave = useCallback(
		(tabId: string | null) => {
			if (!tabId) return false;
			const flushPage = pageSaves.current.get(tabId);
			if (flushPage) {
				flushPage();
				return true;
			}
			const tab = currentTabs().find((item) => item.id === tabId);
			if (!tab) return false;
			if (tab.source) {
				// A Viewer's Ctrl/Cmd+S keeps its draft only, as for any tab.
				const cached = client.getQueryData<CollectionDetail>(
					collectionKey(tab.source.collectionId),
				);
				if (cached?.role !== "editor") return false;
			}
			void saveRequest(tab);
			return true;
		},
		[currentTabs, saveRequest, client],
	);
	const inheritNoteOf = useCallback<InheritNoteOf>(
		(tab) =>
			tab.source ? (
				<InheritSourceNote source={tab.source} onOpen={openNode} />
			) : null,
		[openNode],
	);
	const askTab = tabs.find((tab) => tab.id === askTabId) ?? null;

	if (!enabled) {
		return {
			openNode,
			saveButton: () => null,
			wrap: (children) => children,
			extras: null,
		};
	}
	return {
		openNode,
		onSave,
		renderPage: (page) => <CollectionPage key={page.id} page={page} />,
		renderAboveRequest: (tab) =>
			tab.source ? <RequestBreadcrumb tab={tab} onOpen={openNode} /> : null,
		saveButton: (tab) => <SaveRequestButton tab={tab} onSave={saveRequest} />,
		wrap: (children) => (
			<PageSaveContext value={registerPageSave}>
				<AuthInheritContext value={inheritNoteOf}>
					{children}
				</AuthInheritContext>
			</PageSaveContext>
		),
		extras: (
			<>
				<BoundSavedSync />
				{askTab ? (
					<SaveToCollectionModal
						key={askTab.id}
						tab={askTab}
						open
						onOpenChange={(open) => {
							if (!open) setAskTabId(null);
						}}
					/>
				) : null}
			</>
		),
	};
}
