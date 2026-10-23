import { DRAFT_MAX_TABS } from "@localman/shared/api-client";
import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { useToast } from "../../../components/ui/toast";
import { useT } from "../../../i18n/i18n-context";
import { errorMessage } from "../../../lib/api-client";
import { useOpenCollectionNode } from "../../collections/open-node";
import {
	useWorkbenchActions,
	useWorkbenchState,
} from "../workbench/workbench-context";
import { readOpenInApiClient } from "./open-in-state";
import { loadLogDraft } from "./open-log-draft";
import { useOpenMockRequests } from "./use-open-mock-requests";

/**
 * Opens the requests the project page asked for in `location.state`, once:
 * a request log line as one tab, a project's / resource's mock requests,
 * or the page of a collection synced with the project.
 * Waits until the saved drafts are restored, so the tab cap counts them,
 * then clears the state with a `replace` navigation: a reload or going
 * back to this entry does not open the tabs again.
 */
export function useOpenFromNavigation(): void {
	const t = useT();
	const toast = useToast();
	const location = useLocation();
	const navigate = useNavigate();
	const restoring = useWorkbenchState().syncStatus.state === "loading";
	const { openTab } = useWorkbenchActions();
	const { open } = useOpenMockRequests();
	const openNode = useOpenCollectionNode();
	const openLogLine = useCallback(
		async (projectId: string, logId: string) => {
			const fail = (description?: string) => {
				toast.show({
					tone: "error",
					title: t("trafficLog.openFailed"),
					...(description ? { description } : {}),
				});
			};
			try {
				const draft = await loadLogDraft(projectId, logId);
				if (!draft) {
					fail();
					return;
				}
				if (openTab(draft, { activate: true }) !== null) return;
				toast.show({
					tone: "error",
					title: t("apiClientOpen.toast.full"),
					description: t("apiClientOpen.toast.fullBody", {
						max: DRAFT_MAX_TABS,
					}),
				});
			} catch (error) {
				fail(errorMessage(error));
			}
		},
		[openTab, toast, t],
	);
	// History entry already handled (effects may run twice in development).
	const handledKey = useRef<string | null>(null);

	useEffect(() => {
		if (restoring || handledKey.current === location.key) return;
		const target = readOpenInApiClient(location.state);
		if (!target) return;
		handledKey.current = location.key;
		const { pathname, search, hash } = location;
		void navigate({ pathname, search, hash }, { replace: true, state: null });
		if (target.collection) {
			openNode({
				kind: "collection",
				collectionId: target.collection.id,
				name: target.collection.name,
			});
			return;
		}
		if (target.logId === undefined) {
			void open(target);
			return;
		}
		void openLogLine(target.projectId, target.logId);
	}, [restoring, location, navigate, open, openLogLine, openNode]);
}
