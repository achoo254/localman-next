/**
 * The example page's fields (name and response) as stored with unsaved
 * edits on top, saved like a collection page (autosave, Ctrl/Cmd+S). A
 * body over `EXAMPLE_BODY_MAX` is cut before it goes out, with a toast.
 */
import type {
	CollectionDetail,
	CollectionExampleNode,
	ExampleResponse,
} from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { useWorkbenchActions } from "../api-client/workbench/workbench-context";
import type { CollectionPageTab } from "../api-client/workbench/workbench-tab-types";
import { fitExampleResponse } from "./example-body";
import { updateNode } from "./nodes-api";
import { useRegisterPageSave } from "./page-save-context";
import { collectionKey, useCollection } from "./use-collections";
import { usePageAutosave } from "./use-page-autosave";
import { withNode } from "./use-request-save";

export interface ExampleFields {
	name: string;
	response: ExampleResponse;
}

export function useExampleModel(page: CollectionPageTab) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const { renamePage } = useWorkbenchActions();
	const query = useCollection(page.collectionId);
	const detail = query.data;
	const example = detail?.nodes.find(
		(node): node is CollectionExampleNode =>
			node.kind === "example" && node.id === page.nodeId,
	);

	const save = async (patch: Partial<ExampleFields>): Promise<void> => {
		if (!page.nodeId) return;
		let { response } = patch;
		if (response) {
			const fitted = fitExampleResponse(response);
			response = fitted.response;
			if (fitted.cut) {
				toast.show({ tone: "info", title: t("collections.example.cut") });
			}
		}
		const node = await updateNode(page.collectionId, page.nodeId, {
			...(patch.name ? { name: patch.name } : {}),
			...(response ? { response } : {}),
		});
		client.setQueryData<CollectionDetail>(
			collectionKey(page.collectionId),
			(d) => withNode(d, node),
		);
		if (patch.name) renamePage(page.id, patch.name);
	};
	const autosave = usePageAutosave<ExampleFields>(save);
	useRegisterPageSave(page.id, page.collectionId, autosave);
	const fields: ExampleFields | null = example
		? { name: example.name, response: example.response, ...autosave.pending }
		: null;
	return {
		query,
		detail,
		example,
		fields,
		canEdit: detail?.role === "editor",
		edit: autosave.edit,
		flush: autosave.flush,
		status: autosave.status,
	};
}
