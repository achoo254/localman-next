import {
	COLLECTION_DESCRIPTION_MAX,
	type CollectionDetail,
} from "@localman/shared/api-client";
import { IconPencil } from "@tabler/icons-react";
import { type ReactNode, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { useI18n } from "../../i18n/i18n-context";
import { CollectionMeta } from "./collection-meta";
import { MarkdownView } from "./markdown-view";

export interface PageOverviewProps {
	detail: CollectionDetail;
	/** The folder of a folder page. */
	folderId: string | null;
	description: string;
	canEdit: boolean;
	/** Saves the description now. */
	onSave: (description: string) => void;
	/** Under the details: tags and recent activity of a collection. */
	aside?: ReactNode;
}

/** Markdown description (Edit, Save) beside the collection's details. */
export function PageOverview(props: PageOverviewProps) {
	const { t } = useI18n();
	const [draft, setDraft] = useState<string | null>(null);
	const editButton = useRef<HTMLButtonElement>(null);
	const { detail } = props;
	const stop = (save: boolean) => {
		if (save && draft !== null) props.onSave(draft);
		setDraft(null);
		// The box is gone: focus goes back to Edit.
		window.setTimeout(() => editButton.current?.focus(), 0);
	};

	return (
		<div
			data-id={props.folderId ? "folder-overview" : "collection-overview"}
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
				<CollectionMeta
					detail={detail}
					folderId={props.folderId}
					canEditLinks={props.canEdit && props.folderId === null}
				/>
				{props.aside}
			</section>
		</div>
	);
}
