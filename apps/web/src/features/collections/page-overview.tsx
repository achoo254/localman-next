import {
	COLLECTION_DESCRIPTION_MAX,
	type CollectionDetail,
} from "@localman/shared/api-client";
import { IconPencil } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { useI18n } from "../../i18n/i18n-context";
import { useCurrentUser } from "../auth/use-current-user";
import { useWorkspaces } from "../workspaces/current-workspace";
import { MarkdownView } from "./markdown-view";
import { subtreeIds } from "./tree-drop";

export interface PageOverviewProps {
	detail: CollectionDetail;
	/** The folder of a folder page. */
	folderId: string | null;
	description: string;
	canEdit: boolean;
	/** Saves the description now. */
	onSave: (description: string) => void;
}

function requestCount(
	detail: CollectionDetail,
	folderId: string | null,
): number {
	const inside = folderId ? subtreeIds(detail.nodes, folderId) : null;
	return detail.nodes.filter(
		(node) => node.kind === "request" && (!inside || inside.has(node.id)),
	).length;
}

/** Markdown description (Edit, Save) beside the collection's details. */
export function PageOverview(props: PageOverviewProps) {
	const { t, formatDate } = useI18n();
	const session = useCurrentUser();
	const workspaces = useWorkspaces().data ?? [];
	const [draft, setDraft] = useState<string | null>(null);
	const editButton = useRef<HTMLButtonElement>(null);
	const { detail } = props;
	const me = session.status === "authenticated" ? session.user.sub : null;
	const workspace = workspaces.find((w) => w.id === detail.workspaceId);
	const stop = (save: boolean) => {
		if (save && draft !== null) props.onSave(draft);
		setDraft(null);
		// The box is gone: focus goes back to Edit.
		window.setTimeout(() => editButton.current?.focus(), 0);
	};

	return (
		<div
			data-id="collection-overview"
			className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]"
		>
			<section
				aria-labelledby="collection-description-title"
				className="grid content-start gap-3"
			>
				<div className="flex items-center gap-2">
					<h3
						id="collection-description-title"
						className="m-0 flex-1 font-semibold text-sm"
					>
						{t("collections.page.overview.description")}
					</h3>
					{props.canEdit && draft === null ? (
						<Button
							ref={editButton}
							size="sm"
							variant="ghost"
							data-id="collection-description-edit"
							onClick={() => setDraft(props.description)}
						>
							<IconPencil size={16} aria-hidden="true" />
							{t("collections.page.overview.edit")}
						</Button>
					) : null}
				</div>
				{draft !== null ? (
					<div className="grid gap-2">
						<Textarea
							value={draft}
							rows={10}
							autoFocus
							maxLength={COLLECTION_DESCRIPTION_MAX}
							aria-label={t("collections.page.overview.inputLabel")}
							data-id="collection-description-input"
							onChange={(event) => setDraft(event.target.value)}
						/>
						<p className="m-0 text-muted text-xs">
							{t("collections.page.overview.hint")}
						</p>
						<div className="flex gap-2">
							<Button
								size="sm"
								variant="primary"
								data-id="collection-description-save"
								onClick={() => stop(true)}
							>
								{t("collections.page.overview.save")}
							</Button>
							<Button size="sm" variant="ghost" onClick={() => stop(false)}>
								{t("common.actions.cancel")}
							</Button>
						</div>
					</div>
				) : props.description.trim() ? (
					<div data-id="collection-description">
						<MarkdownView source={props.description} />
					</div>
				) : (
					<p
						data-id="collection-description"
						className="m-0 text-muted text-sm"
					>
						{t("collections.page.overview.empty")}
					</p>
				)}
			</section>
			<section
				aria-labelledby="collection-details-title"
				className="grid content-start gap-2"
			>
				<h3 id="collection-details-title" className="m-0 font-semibold text-sm">
					{t("collections.page.overview.details")}
				</h3>
				<dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
					<dt className="text-muted">
						{t("collections.page.overview.createdBy")}
					</dt>
					<dd className="m-0">
						{detail.createdBy === me
							? t("collections.page.overview.you")
							: t("collections.page.overview.member")}
					</dd>
					<dt className="text-muted">
						{t("collections.page.overview.updated")}
					</dt>
					<dd className="m-0">{formatDate(detail.updatedAt)}</dd>
					<dt className="text-muted">
						{t("collections.page.overview.workspace")}
					</dt>
					<dd className="m-0 truncate">{workspace?.name ?? "—"}</dd>
					<dt className="text-muted">
						{t("collections.page.overview.requests")}
					</dt>
					<dd className="m-0" data-id="collection-request-count">
						{requestCount(detail, props.folderId)}
					</dd>
				</dl>
			</section>
		</div>
	);
}
