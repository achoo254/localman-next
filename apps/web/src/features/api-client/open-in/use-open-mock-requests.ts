/**
 * Loads a mock project's URLs and opens its requests as workbench tabs:
 * one resource's list request, or every CRUD request of the project. The
 * tab cap is honoured; what does not fit is reported in a toast.
 */
import { DRAFT_MAX_TABS } from "@localman/shared/api-client";
import { useCallback, useState } from "react";
import { useToast } from "../../../components/ui/toast";
import { useT } from "../../../i18n/i18n-context";
import { errorMessage } from "../../../lib/api-client";
import { useWorkbenchActions } from "../workbench/workbench-context";
import {
	type MockRequest,
	type MockRequestNamer,
	fitTabs,
	listRequestOf,
	mockRequestsOf,
} from "./mock-requests";
import { fetchMockUrls } from "./mock-urls-api";
import type { OpenInApiClient } from "./open-in-state";

export interface OpenMockRequests {
	open: (target: OpenInApiClient) => Promise<void>;
	/** Mock URLs are loading. */
	pending: boolean;
}

export function useOpenMockRequests(): OpenMockRequests {
	const t = useT();
	const toast = useToast();
	const { currentTabs, openTab } = useWorkbenchActions();
	const [pending, setPending] = useState(false);

	const open = useCallback(
		async (target: OpenInApiClient) => {
			const nameOf: MockRequestNamer = (kind, name) =>
				t(`apiClientOpen.names.${kind}`, { name });
			setPending(true);
			try {
				const urls = await fetchMockUrls(target.projectId);
				let requests: MockRequest[];
				if (target.resourceId === undefined) {
					requests = mockRequestsOf(urls, nameOf);
				} else {
					const resource = urls.resources.find(
						(item) => item.id === target.resourceId,
					);
					if (!resource) {
						toast.show({
							tone: "error",
							title: t("apiClientOpen.toast.resourceMissing"),
						});
						return;
					}
					requests = [listRequestOf(resource, nameOf)];
				}
				if (requests.length === 0) {
					toast.show({
						tone: "info",
						title: t("apiClientOpen.toast.noEndpoints"),
					});
					return;
				}
				// Read after the fetch: the tabs may have changed meanwhile.
				const room = DRAFT_MAX_TABS - currentTabs().length;
				const { opened, skipped } = fitTabs(requests, room);
				opened.forEach((request, index) => {
					openTab(request.draft, { activate: index === 0 });
				});
				if (skipped === 0) return;
				const max = DRAFT_MAX_TABS;
				toast.show(
					opened.length === 0
						? {
								tone: "error",
								title: t("apiClientOpen.toast.full"),
								description: t("apiClientOpen.toast.fullBody", { max }),
							}
						: {
								tone: "info",
								title: t("apiClientOpen.toast.truncated", {
									opened: opened.length,
									total: requests.length,
								}),
								description: t("apiClientOpen.toast.truncatedBody", { max }),
							},
				);
			} catch (error) {
				toast.show({
					tone: "error",
					title: t("apiClientOpen.toast.loadFailed"),
					description: errorMessage(error),
				});
			} finally {
				setPending(false);
			}
		},
		[t, toast, currentTabs, openTab],
	);

	return { open, pending };
}
