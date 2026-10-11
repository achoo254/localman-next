import { type TabSource, requestContext } from "@localman/shared/api-client";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { collectionErrorMessage } from "./collection-errors";
import type { OpenNode } from "./open-node";
import { useCollection } from "./use-collections";

export interface InheritSourceNoteProps {
	source: TabSource;
	onOpen: OpenNode;
}

/**
 * Where an `inherit` request takes its auth from, with a link to it; says
 * so when its collection cannot be read or the request left it.
 */
export function InheritSourceNote({ source, onOpen }: InheritSourceNoteProps) {
	const t = useT();
	const collection = useCollection(source.collectionId);
	const detail = collection.data;
	if (collection.isError) {
		return (
			<span data-id="auth-inherit-source-error">
				{t("collections.inherit.failed", {
					reason: collectionErrorMessage(collection.error, t),
				})}
			</span>
		);
	}
	if (!detail) return <span>{t("collections.inherit.loading")}</span>;
	const context = requestContext(detail, source.nodeId);
	if (!context) {
		return (
			<span data-id="auth-inherit-source-error">
				{t("collections.inherit.gone")}
			</span>
		);
	}
	const from = context.authSource;
	const key =
		from.kind === "folder"
			? "collections.inherit.fromFolder"
			: "collections.inherit.fromCollection";
	// The name goes in through the renderer, never parsed as tags.
	return (
		<span>
			{renderRich(t(key, { name: "" }), {
				link: () => (
					<button
						type="button"
						data-id="auth-inherit-source-link"
						className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-primary underline"
						onClick={() =>
							onOpen(
								from.kind === "collection"
									? {
											kind: "collection",
											collectionId: detail.id,
											name: from.name,
										}
									: {
											kind: "folder",
											collectionId: detail.id,
											nodeId: from.id,
											name: from.name,
										},
							)
						}
					>
						{from.name}
					</button>
				),
			})}
		</span>
	);
}
