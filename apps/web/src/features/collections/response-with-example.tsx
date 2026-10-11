import type {
	ApiRequestDraft,
	RouteMode,
	TabSource,
} from "@localman/shared/api-client";
import { IconBookmarkPlus } from "@tabler/icons-react";
import { memo } from "react";
import { Button } from "../../components/ui/button";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { RoutedResponsePanel } from "../api-client/routing/routed-response-panel";
import { useWorkbenchActions } from "../api-client/workbench/workbench-context";
import { newId } from "../api-client/workbench/workbench-ids";
import type {
	SendResult,
	TabResponse,
} from "../api-client/workbench/workbench-types";
import { collectionErrorMessage } from "./collection-errors";
import { fitExampleResponse } from "./example-body";
import { exampleFromResponse, exampleName } from "./example-response";
import { useCollection } from "./use-collections";
import { useCreateNode } from "./use-node-mutations";

interface SaveExampleProps {
	tabId: string;
	source: TabSource;
	result: SendResult;
	/** The draft that produced `result`; the tab's current one otherwise. */
	sent: ApiRequestDraft | undefined;
}

/** "Save as example" over a response of a bound tab (Editors only). */
function SaveExampleButton({ tabId, source, result, sent }: SaveExampleProps) {
	const t = useT();
	const toast = useToast();
	const { currentTabs } = useWorkbenchActions();
	const collection = useCollection(source.collectionId);
	const create = useCreateNode();
	if (collection.data?.role !== "editor") return null;
	const save = () => {
		const tab = currentTabs().find((item) => item.id === tabId);
		if (!tab) return;
		const fitted = fitExampleResponse(
			exampleFromResponse(result.response, newId),
		);
		const name =
			exampleName(fitted.response) || t("collections.defaults.example");
		create.mutate(
			{
				collectionId: source.collectionId,
				node: {
					kind: "example",
					parentId: source.nodeId,
					name,
					request: sent ?? tab.draft,
					response: fitted.response,
				},
			},
			{
				onSuccess: () =>
					toast.show({
						tone: "success",
						title: t("collections.example.saved", { name }),
						description: fitted.cut ? t("collections.example.cut") : undefined,
					}),
				onError: (error) =>
					toast.show({
						tone: "error",
						title: collectionErrorMessage(error, t),
					}),
			},
		);
	};
	return (
		<Button
			size="sm"
			variant="ghost"
			data-id="response-save-example"
			loading={create.isPending}
			onClick={save}
		>
			<IconBookmarkPlus size={16} aria-hidden="true" />
			{t("collections.example.saveFromResponse")}
		</Button>
	);
}

export interface ResponseWithExampleProps {
	tabId: string;
	response: TabResponse;
	route: RouteMode;
	source: TabSource | null;
}

/** The response area of a tab, with "Save as example" for bound tabs. */
export const ResponseWithExample = memo(function ResponseWithExample({
	tabId,
	response,
	route,
	source,
}: ResponseWithExampleProps) {
	const done = response.kind === "done" ? response : null;
	return (
		<RoutedResponsePanel
			tabId={tabId}
			response={response}
			route={route}
			resultActions={
				source && done ? (
					<SaveExampleButton
						tabId={tabId}
						source={source}
						result={done.result}
						sent={done.draft}
					/>
				) : undefined
			}
		/>
	);
});
