import {
	COLLECTION_SEARCH_RESULTS_MAX,
	type CollectionSearchMatch,
} from "@localman/shared/api-client";
import { IconFolder, IconStack2 } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import type { KeyboardEvent } from "react";
import { Alert } from "../../components/ui/alert";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { METHOD_TEXT_CLASS, methodShortLabel } from "../../lib/method-tone";
import { HighlightName } from "./highlight-name";
import type { OpenNode } from "./open-node";
import { useCollectionSearch } from "./use-collection-search";
import { readCollection } from "./use-send-context";

export interface CollectionSearchResultsProps {
	workspaceId: string | null;
	/** The search text once typing paused. */
	query: string;
	onOpen: OpenNode;
}

/** ↑/↓ move between results, Home/End to the ends. */
function moveFocus(event: KeyboardEvent<HTMLUListElement>): void {
	const buttons = [...event.currentTarget.querySelectorAll("button")];
	const at = buttons.findIndex((button) => button === document.activeElement);
	const targets: Record<string, HTMLButtonElement | undefined> = {
		ArrowDown: buttons[at + 1],
		ArrowUp: buttons[at - 1],
		Home: buttons[0],
		End: buttons.at(-1),
	};
	const next = Object.hasOwn(targets, event.key)
		? targets[event.key]
		: undefined;
	if (!next) return;
	event.preventDefault();
	next.focus();
}

function Lead({ match }: { match: CollectionSearchMatch }) {
	if (match.kind === "request" && match.method) {
		return (
			<span
				className={cn(
					"w-8 flex-none font-bold font-mono text-[0.625rem]",
					METHOD_TEXT_CLASS[match.method],
				)}
			>
				{methodShortLabel(match.method)}
			</span>
		);
	}
	const Icon = match.kind === "collection" ? IconStack2 : IconFolder;
	return (
		<Icon size={16} aria-hidden="true" className="flex-none text-icon-muted" />
	);
}

/** Server search results as a flat list: name (match marked) and where it is. */
export function CollectionSearchResults({
	workspaceId,
	query: settled,
	onOpen,
}: CollectionSearchResultsProps) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const search = useCollectionSearch(workspaceId, settled);
	const open = async (match: CollectionSearchMatch): Promise<void> => {
		const { collectionId, nodeId, name } = match;
		if (match.kind === "collection" || nodeId === null) {
			onOpen({ kind: "collection", collectionId, name });
			return;
		}
		if (match.kind === "folder") {
			onOpen({ kind: "folder", collectionId, nodeId, name });
			return;
		}
		try {
			const collection = await readCollection(client, collectionId);
			const node = collection.nodes.find((item) => item.id === nodeId);
			if (node?.kind !== "request") throw new Error("Request gone");
			onOpen({ kind: "request", collection, node });
		} catch {
			toast.show({
				tone: "error",
				title: t("collections.sidebar.openFailed", { name }),
			});
		}
	};

	if (search.isError) {
		return (
			<Alert tone="danger" className="mx-3 my-2">
				{t("collections.sidebar.searchFailed")}{" "}
				<button
					type="button"
					className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-primary underline"
					onClick={() => void search.refetch()}
				>
					{t("common.cta.retry")}
				</button>
			</Alert>
		);
	}
	const data = search.data;
	if (!data) {
		return (
			<SkeletonRegion
				data-id="sidebar-search-loading"
				label={t("collections.sidebar.searching")}
				className="grid gap-2 px-3 py-2"
			>
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-3/4" />
			</SkeletonRegion>
		);
	}
	return (
		<div className="grid gap-1 py-1" aria-busy={search.isFetching || undefined}>
			<output className="sr-only">
				{t("collections.sidebar.results", { count: data.matches.length })}
			</output>
			{data.matches.length === 0 ? (
				<p className="m-0 px-3 py-6 text-center text-muted text-sm">
					{t("collections.sidebar.noMatch", { query: settled })}
				</p>
			) : (
				<ul
					aria-label={t("collections.sidebar.resultsLabel")}
					data-id="sidebar-search-results"
					className="m-0 grid list-none gap-px p-0 px-1"
					onKeyDown={moveFocus}
				>
					{data.matches.map((match) => (
						<li key={`${match.collectionId}:${match.nodeId ?? ""}`}>
							<button
								type="button"
								data-id="sidebar-search-result"
								className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-xs border-0 bg-transparent px-2 py-1 text-left text-[0.8125rem] hover:bg-fg/5 focus-visible:shadow-focus-primary focus-visible:outline-none pointer-coarse:min-h-10"
								onClick={() => void open(match)}
							>
								<Lead match={match} />
								<span className="grid min-w-0 flex-1">
									<span
										className={cn(
											"truncate",
											match.kind === "collection" && "font-semibold",
										)}
									>
										<HighlightName name={match.name} query={settled} />
									</span>
									{match.kind === "collection" ? null : (
										<span className="truncate text-muted text-xs">
											{[match.collectionName, ...match.path].join(" / ")}
										</span>
									)}
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
			{data.truncated ? (
				<p className="m-0 px-3 py-2 text-muted text-xs">
					{t("collections.sidebar.truncated", {
						max: COLLECTION_SEARCH_RESULTS_MAX,
					})}
				</p>
			) : null}
		</div>
	);
}
