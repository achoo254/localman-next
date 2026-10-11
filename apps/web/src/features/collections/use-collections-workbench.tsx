/**
 * What collections add to the workbench while the workspaces flag is on:
 * collection and folder pages, the breadcrumb and Save of bound requests,
 * the inherited-auth note, Ctrl/Cmd+S and the "Save to collection"
 * dialog. Off, every part is absent and the workbench behaves as before.
 */
import type { CollectionDetail } from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
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
import { ExamplePage } from "./example-page";
import { InheritSourceNote } from "./inherit-source-note";
import { type OpenNode, useOpenCollectionNode } from "./open-node";
import {
	PageSaveContext,
	type PageSaveEntry,
	type PageSaves,
} from "./page-save-context";
import { RequestBreadcrumb } from "./request-breadcrumb";
import { ResponseWithExample } from "./response-with-example";
import { type RightPanel, RightPanelContext } from "./right-panel-context";
import { RightRail } from "./right-rail";
import { SaveRequestButton } from "./save-request-button";
import { SaveToCollectionModal } from "./save-to-collection-modal";
import { collectionKey } from "./use-collections";
import { usePagePersistence } from "./use-page-persistence";
import { useRequestSave } from "./use-request-save";

export interface CollectionsWorkbench {
	openNode: OpenNode;
	onSave?: (tabId: string | null) => boolean;
	renderPage?: (page: PageTab) => ReactNode;
	renderAboveRequest?: (tab: WorkbenchTab) => ReactNode;
	/** Response area with "Save as example" for bound tabs. */
	renderResponse?: (tab: WorkbenchTab) => ReactNode;
	saveButton: (tab: WorkbenchTab) => ReactNode;
	/** Wraps the workbench with the contexts pages and the auth pane read. */
	wrap: (children: ReactNode) => ReactNode;
	/** The save dialog and the restored-tab sync. */
	extras: ReactNode;
	/** Info and Changelog of the active tab's collection, if any. */
	rightRail?: ReactNode;
}

export function useCollectionsWorkbench(
	enabled: boolean,
): CollectionsWorkbench {
	const openNode = useOpenCollectionNode();
	usePagePersistence(enabled);
	const client = useQueryClient();
	const { currentTabs } = useWorkbenchActions();
	const { tabs, activeTab, activePage } = useWorkbenchState();
	const [panel, setPanel] = useState<RightPanel | null>(null);
	const railCollection =
		activePage?.collectionId ?? activeTab?.source?.collectionId;
	const [askTabId, setAskTabId] = useState<string | null>(null);
	const saveRequest = useRequestSave(setAskTabId);
	const pageSaves = useRef(new Map<string, PageSaveEntry>());
	const openPages = useMemo<PageSaves>(
		() => ({
			register: (pageId, entry) => {
				if (entry) pageSaves.current.set(pageId, entry);
				else pageSaves.current.delete(pageId);
			},
			discard: (collectionId) =>
				[...pageSaves.current.values()].filter(
					(entry) => entry.collectionId === collectionId && entry.discard(),
				).length,
		}),
		[],
	);
	const onSave = useCallback(
		(tabId: string | null) => {
			if (!tabId) return false;
			const openPage = pageSaves.current.get(tabId);
			if (openPage) {
				openPage.flush();
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
	const rightPanel = useMemo(() => ({ panel, setPanel }), [panel]);

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
		renderPage: (page) =>
			page.kind === "example" ? (
				<ExamplePage key={page.id} page={page} onOpen={openNode} />
			) : (
				<CollectionPage key={page.id} page={page} />
			),
		renderResponse: (tab) => (
			<ResponseWithExample
				key={tab.id}
				tabId={tab.id}
				response={tab.response}
				route={tab.draft.settings.route}
				source={tab.source}
			/>
		),
		renderAboveRequest: (tab) =>
			tab.source ? <RequestBreadcrumb tab={tab} onOpen={openNode} /> : null,
		saveButton: (tab) => <SaveRequestButton tab={tab} onSave={saveRequest} />,
		rightRail: railCollection ? (
			<RightRail
				collectionId={railCollection}
				folderId={activePage?.kind === "folder" ? activePage.nodeId : null}
			/>
		) : null,
		wrap: (children) => (
			<RightPanelContext value={rightPanel}>
				<PageSaveContext value={openPages}>
					<AuthInheritContext value={inheritNoteOf}>
						{children}
					</AuthInheritContext>
				</PageSaveContext>
			</RightPanelContext>
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
