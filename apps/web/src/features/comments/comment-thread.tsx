import type { CommentThreadView } from "@localman/shared/api-client";
import { IconCheck, IconRefresh } from "@tabler/icons-react";
import { useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { AnchorLabel } from "./anchor-label";
import { CommentComposer } from "./comment-composer";
import { CommentItem } from "./comment-item";
import type { MentionCandidate } from "./mention-suggestions";
import type { ThreadActions } from "./thread-actions";

export interface CommentThreadProps {
	thread: CommentThreadView;
	people: readonly MentionCandidate[];
	actions: ThreadActions;
	/** Brought into view from a link or a marker. */
	focused: boolean;
}

/** A thread: its anchor, comments, reply box and Resolve/Reopen. */
export function CommentThread({
	thread,
	people,
	actions,
	focused,
}: CommentThreadProps) {
	const t = useT();
	const [replying, setReplying] = useState(false);
	const resolved = thread.resolvedAt !== null;
	const threadActions: ThreadActions = {
		...actions,
		// Deleting the first comment deletes the thread: say so first.
		remove: (id) => actions.remove(id, id === thread.id),
	};
	return (
		<li
			data-id="comment-thread"
			data-thread-id={thread.id}
			className={cn(
				"grid gap-3 rounded-md border bg-surface p-3",
				focused
					? "border-primary shadow-focus-primary"
					: "border-border-subtle",
				resolved && "opacity-80",
			)}
		>
			{thread.anchor || resolved ? (
				<div className="flex flex-wrap items-center gap-2">
					{thread.anchor ? <AnchorLabel anchor={thread.anchor} /> : null}
					{thread.anchor?.outdated ? (
						<Badge tone="warning">{t("collections.comments.outdated")}</Badge>
					) : null}
					{resolved ? (
						<Badge tone="success">{t("collections.comments.resolved")}</Badge>
					) : null}
				</div>
			) : null}
			<ol className="m-0 grid list-none gap-3 p-0">
				{thread.comments.map((comment) => (
					<CommentItem
						key={comment.id}
						comment={comment}
						people={people}
						actions={threadActions}
					/>
				))}
			</ol>
			{replying ? (
				<CommentComposer
					label={t("collections.comments.replyLabel")}
					submitLabel={t("collections.comments.reply")}
					people={people}
					dataId="comment-reply"
					autoFocus
					onCancel={() => setReplying(false)}
					onSubmit={async (body) => {
						await actions.reply(thread.id, body);
						setReplying(false);
					}}
				/>
			) : (
				<div className="flex flex-wrap gap-2">
					<Button
						size="sm"
						variant="ghost"
						data-id="comment-reply"
						onClick={() => setReplying(true)}
					>
						{t("collections.comments.reply")}
					</Button>
					{thread.canResolve ? (
						<Button
							size="sm"
							variant="ghost"
							data-id="comment-resolve"
							onClick={() => actions.resolve(thread.id, !resolved)}
						>
							{resolved ? (
								<IconRefresh size={14} aria-hidden="true" />
							) : (
								<IconCheck size={14} aria-hidden="true" />
							)}
							{resolved
								? t("collections.comments.reopen")
								: t("collections.comments.resolve")}
						</Button>
					) : null}
				</div>
			)}
		</li>
	);
}
