import { DRAFT_MAX_TABS } from "@localman/shared/api-client";
import { IconCode, IconUpload } from "@tabler/icons-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { useToast } from "../../components/ui/toast";
import type { HistoryDetail } from "../../features/api-client/history/history-api";
import { HistorySidebar } from "../../features/api-client/history/history-sidebar";
import { hasBlankedSecrets } from "../../features/api-client/history/redact-draft";
import { ExportMenu } from "../../features/api-client/import-export/export-menu";
import { ImportModal } from "../../features/api-client/import-export/import-modal";
import type { ImportMode } from "../../features/api-client/import-export/import-save-mode";
import type { ImportSelection } from "../../features/api-client/import-export/open-imported";
import { FromMockAction } from "../../features/api-client/open-in/from-mock-action";
import { OpenFromNavigation } from "../../features/api-client/open-in/open-from-navigation";
import { previewRequest } from "../../features/api-client/request/prepare-preview";
import { RoutedResponsePanel } from "../../features/api-client/routing/routed-response-panel";
import { CodeSnippetModal } from "../../features/api-client/snippets/code-snippet-modal";
import {
	useWorkbenchActions,
	useWorkbenchState,
} from "../../features/api-client/workbench/workbench-context";
import { WorkbenchLayout } from "../../features/api-client/workbench/workbench-layout";
import type { WorkbenchTab } from "../../features/api-client/workbench/workbench-types";
import { CollectionsImportModal } from "../../features/collections/collections-import-modal";
import { CollectionsSidebar } from "../../features/collections/collections-sidebar";
import { useCollectionsWorkbench } from "../../features/collections/use-collections-workbench";
import { useWorkspacesEnabled } from "../../features/workspaces/use-workspaces-enabled";
import { useT } from "../../i18n/i18n-context";

function renderResponse(tab: WorkbenchTab) {
	return (
		<RoutedResponsePanel
			// One panel per tab: a spinner held for one tab never shows on another.
			key={tab.id}
			tabId={tab.id}
			response={tab.response}
			route={tab.draft.settings.route}
		/>
	);
}

/** The workbench with history, import/export, code snippets and the response viewer. */
export function ApiClientScreen() {
	const t = useT();
	const toast = useToast();
	const actions = useWorkbenchActions();
	const { tabs, activeTab, activePage } = useWorkbenchState();
	const openedId = activePage
		? (activePage.nodeId ?? activePage.collectionId)
		: (activeTab?.source?.nodeId ?? null);
	const [importOpen, setImportOpen] = useState(false);
	const [importMode, setImportMode] = useState<ImportMode>("tabs");
	const workspacesOn = useWorkspacesEnabled();
	const bound = useCollectionsWorkbench(workspacesOn);
	const openCollectionNode = bound.openNode;
	const openImport = useCallback((mode: ImportMode) => {
		setImportMode(mode);
		setImportOpen(true);
	}, []);
	const [snippetOpen, setSnippetOpen] = useState(false);

	const openImported = (selection: ImportSelection) => {
		// Environments come with phase 13's variables; requests open as tabs.
		if (selection.kind !== "requests") return;
		selection.requests.forEach((request, index) => {
			actions.openTab(request.draft, { activate: index === 0 });
		});
	};

	// Stable, so the memoized history and export menu skip editor keystrokes.
	const openFromHistory = useCallback(
		(entry: HistoryDetail) => {
			const redacted = hasBlankedSecrets(entry.draft);
			if (actions.openTab(entry.draft, { redacted }) !== null) return;
			toast.show({
				tone: "error",
				title: t("apiClientOpen.toast.full"),
				description: t("apiClientOpen.toast.fullBody", { max: DRAFT_MAX_TABS }),
			});
		},
		[actions, toast, t],
	);
	const readRequests = useCallback(
		() => actions.currentTabs().map(({ id, draft }) => ({ id, draft })),
		[actions],
	);

	// Same element between renders, like the callbacks: the history stays memoized.
	const historyTools = useMemo(
		() => (
			<>
				<IconButton
					size="sm"
					data-id="sidebar-import"
					label={t("apiClient.actions.import")}
					title={t("apiClient.actions.import")}
					icon={<IconUpload size={18} aria-hidden="true" />}
					onClick={() => openImport("tabs")}
				/>
				<ExportMenu readRequests={readRequests} compact />
			</>
		),
		[t, readRequests, openImport],
	);
	// Collections (workspaces flag): first in the rail, imports save there.
	const collections = useMemo(
		() =>
			workspacesOn ? (
				<CollectionsSidebar
					onOpenNode={openCollectionNode}
					onImport={() => openImport("collection")}
					openedId={openedId}
				/>
			) : undefined,
		[workspacesOn, openCollectionNode, openImport, openedId],
	);
	const Import = workspacesOn ? CollectionsImportModal : ImportModal;

	const importButton = (dataId: string) => (
		<Button
			variant="secondary"
			size="sm"
			data-id={dataId}
			onClick={() => openImport("tabs")}
		>
			<IconUpload size={16} aria-hidden="true" />
			{t("apiClient.actions.import")}
		</Button>
	);

	return bound.wrap(
		<>
			<OpenFromNavigation />
			<WorkbenchLayout
				sidebar={
					<HistorySidebar onOpen={openFromHistory} tools={historyTools} />
				}
				collections={collections}
				renderPage={bound.renderPage}
				renderAboveRequest={bound.renderAboveRequest}
				onSave={bound.onSave}
				rightRail={bound.rightRail}
				renderHeadActions={(tab) => (
					<>
						{bound.saveButton(tab)}
						<Button
							variant="ghost"
							size="sm"
							data-id="request-head-code"
							onClick={() => setSnippetOpen(true)}
						>
							<IconCode size={16} aria-hidden="true" />
							<span className="max-sm:sr-only">
								{t("apiClient.actions.code")}
							</span>
						</Button>
					</>
				)}
				renderResponse={bound.renderResponse ?? renderResponse}
				emptyActions={
					<>
						{importButton("editor-empty-import")}
						<FromMockAction data-id="editor-empty-from-mock" />
					</>
				}
			/>
			<Import
				open={importOpen}
				onOpenChange={setImportOpen}
				onImport={openImported}
				maxRequests={DRAFT_MAX_TABS - tabs.length}
				initialMode={importMode}
			/>
			<CodeSnippetModal
				open={snippetOpen}
				onOpenChange={setSnippetOpen}
				request={
					snippetOpen && activeTab ? previewRequest(activeTab.draft) : null
				}
			/>
			{bound.extras}
		</>,
	);
}
