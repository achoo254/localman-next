import type { CommentView } from "@localman/shared/api-client";
import { IconLink, IconPencil, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { IconButton } from "../../components/ui/icon-button";
import { useI18n } from "../../i18n/i18n-context";
import { initialOf } from "../../lib/initial";
import { MarkdownView } from "../collections/markdown-view";
import { CommentComposer } from "./comment-composer";
import { CommentReactions } from "./comment-reactions";
import type { MentionCandidate } from "./mention-suggestions";
import type { ThreadActions } from "./thread-actions";

export interface CommentItemProps {
	comment: CommentView;
	people: readonly MentionCandidate[];
	actions: ThreadActions;
}

/** One comment: author, time, Markdown body, reactions and its actions. */
export function CommentItem({ comment, people, actions }: CommentItemProps) {
	const { t, formatDate } = useI18n();
	const [editing, setEditing] = useState(false);
	const author = comment.authorName ?? t("collections.comments.removedAccount");
	return (
		<li
			data-id="comment-item"
			data-comment-id={comment.id}
			className="grid gap-1"
		>
			<div className="flex items-center gap-2">
				<span
					aria-hidden="true"
					className="grid size-7 flex-none place-items-center rounded-full bg-primary/10 font-bold text-primary text-xs"
				>
					{initialOf(comment.authorName)}
				</span>
				<div className="grid min-w-0 flex-1">
					<span className="truncate font-semibold text-sm">{author}</span>
					<span className="text-muted text-xs">
						{formatDate(comment.createdAt)}
						{comment.editedAt ? ` ${t("collections.comments.edited")}` : ""}
					</span>
				</div>
				<IconButton
					size="sm"
					variant="ghost"
					data-id="comment-copy-link"
					label={t("collections.comments.copyLink")}
					icon={<IconLink size={16} aria-hidden="true" />}
					onClick={() => actions.copyLink(comment.id)}
				/>
				{comment.canEdit && !editing ? (
					<IconButton
						size="sm"
						variant="ghost"
						data-id="comment-edit"
						label={t("collections.comments.edit")}
						icon={<IconPencil size={16} aria-hidden="true" />}
						onClick={() => setEditing(true)}
					/>
				) : null}
				{comment.canDelete ? (
					<IconButton
						size="sm"
						variant="ghost"
						data-id="comment-delete"
						label={t("collections.comments.delete")}
						icon={<IconTrash size={16} aria-hidden="true" />}
						onClick={() => actions.remove(comment.id)}
					/>
				) : null}
			</div>
			{editing ? (
				<CommentComposer
					label={t("collections.comments.editLabel")}
					submitLabel={t("collections.comments.save")}
					people={people}
					initial={comment.body}
					dataId="comment-edit"
					autoFocus
					onCancel={() => setEditing(false)}
					onSubmit={async (body) => {
						await actions.edit(comment.id, body);
						setEditing(false);
					}}
				/>
			) : (
				<div data-id="comment-body" className="break-words pl-9">
					<MarkdownView source={comment.body} />
				</div>
			)}
			<div className="pl-9">
				<CommentReactions
					reactions={comment.reactions}
					onToggle={(reaction, on) => actions.react(comment.id, reaction, on)}
				/>
			</div>
		</li>
	);
}
