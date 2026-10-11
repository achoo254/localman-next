import { workspaceRoleAllows } from "@localman/shared/access";
/**
 * Creating collections in the current workspace: blank, from the REST
 * CRUD template, from a mock project, or from an import.
 */
import type {
	CollectionDetail,
	ImportedCollection,
} from "@localman/shared/api-client";
import { useCallback } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import type { Translate } from "../../i18n/translate";
import {
	type MockRequestNamer,
	mockRequestsOf,
} from "../api-client/open-in/mock-requests";
import { fetchMockUrls } from "../api-client/open-in/mock-urls-api";
import { useCurrentWorkspace } from "../workspaces/current-workspace";
import { collectionErrorMessage, translatedError } from "./collection-errors";
import {
	type FallbackNames,
	fitTree,
	mockProjectTree,
} from "./collection-trees";
import type { CollectionSource } from "./collections-api";
import { useCreateCollection } from "./use-collection-mutations";

function fallbackNames(t: Translate): FallbackNames {
	return {
		collection: t("collections.defaults.importedCollection"),
		folder: t("collections.defaults.importedFolder"),
		request: t("collections.defaults.importedRequest"),
	};
}

/** `rename`: the new collection opens in the rename box (a blank one). */
export type OnCollectionCreated = (
	detail: CollectionDetail,
	rename: boolean,
) => void;

/** Each call resolves `true` once the collection exists (errors are toasted). */
export interface CollectionCreator {
	/** A create call is on its way. */
	pending: boolean;
	blank: () => Promise<boolean>;
	template: () => Promise<boolean>;
	fromMock: (projectId: string, projectName: string) => Promise<boolean>;
}

export function useCollectionCreate(
	workspaceId: string,
	onCreated: OnCollectionCreated,
): CollectionCreator {
	const t = useT();
	const toast = useToast();
	const create = useCreateCollection(workspaceId);
	const fail = useCallback(
		(error: unknown) =>
			toast.show({ tone: "error", title: collectionErrorMessage(error, t) }),
		[toast, t],
	);
	const run = async (source: CollectionSource, rename: boolean) => {
		try {
			const detail = await create.mutateAsync(source);
			toast.show({
				tone: "success",
				title: t("collections.toast.created", { name: detail.name }),
			});
			onCreated(detail, rename);
			return true;
		} catch (error) {
			fail(error);
			return false;
		}
	};
	const fromMock = async (projectId: string, projectName: string) => {
		const nameOf: MockRequestNamer = (kind, name) =>
			t(`apiClientOpen.names.${kind}`, { name });
		try {
			const urls = await fetchMockUrls(projectId);
			const requests = mockRequestsOf(urls, nameOf);
			const tree = mockProjectTree(projectName, urls.resources, requests);
			return await run({ tree: fitTree(tree, fallbackNames(t)) }, false);
		} catch (error) {
			fail(error);
			return false;
		}
	};
	return {
		pending: create.isPending,
		blank: () => run({ name: t("collections.defaults.collection") }, true),
		template: () => run({ template: "rest-crud" }, false),
		fromMock,
	};
}

export interface SaveImported {
	/** Where it is saved, for the dialog's hint. */
	workspaceName: string;
	/** Rejects with an error whose message is ready to show. */
	save: (collection: ImportedCollection) => Promise<void>;
}

/**
 * "Save as collection" of the import dialog (workspaces flag on): `null`
 * while the workspaces load or when the caller cannot add collections to
 * the current one.
 */
export function useSaveImportedCollection(): SaveImported | null {
	const t = useT();
	const toast = useToast();
	const { current } = useCurrentWorkspace();
	const create = useCreateCollection(current?.id ?? "");
	if (!current || !workspaceRoleAllows(current.role, "addElements")) {
		return null;
	}
	const save = async (collection: ImportedCollection): Promise<void> => {
		const { format: _format, warnings: _warnings, ...tree } = collection;
		try {
			const detail = await create.mutateAsync({
				tree: fitTree(tree, fallbackNames(t)),
			});
			toast.show({
				tone: "success",
				title: t("collections.toast.saved", {
					name: detail.name,
					workspace: current.name,
				}),
			});
		} catch (error) {
			throw translatedError(error, t);
		}
	};
	return { workspaceName: current.name, save };
}
