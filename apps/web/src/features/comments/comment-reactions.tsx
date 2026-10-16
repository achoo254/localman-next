import {
	COMMENT_REACTIONS,
	type CommentReaction,
	type CommentReactionView,
} from "@localman/shared/api-client";
import { IconMoodPlus } from "@tabler/icons-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { IconButton } from "../../components/ui/icon-button";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

/** The emoji drawn for each reaction key. */
export const REACTION_EMOJI: Record<CommentReaction, string> = {
	thumbsUp: "👍",
	tada: "🎉",
	heart: "❤️",
	eyes: "👀",
	rocket: "🚀",
};

export interface CommentReactionsProps {
	reactions: readonly CommentReactionView[];
	onToggle: (reaction: CommentReaction, on: boolean) => void;
}

/** Given reactions as toggles, and a picker for the others. */
export function CommentReactions({
	reactions,
	onToggle,
}: CommentReactionsProps) {
	const t = useT();
	const given = new Map(reactions.map((item) => [item.key, item]));
	return (
		<div className="flex flex-wrap items-center gap-1">
			{reactions.map((item) => (
				<button
					key={item.key}
					type="button"
					aria-pressed={item.mine}
					aria-label={t("collections.comments.reactionCount", {
						reaction: t(`collections.comments.reactions.${item.key}`),
						count: item.count,
					})}
					data-id="comment-reaction"
					className={cn(
						"inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-full border px-2 text-xs",
						item.mine
							? "border-primary bg-primary/10 text-primary"
							: "border-border-subtle bg-surface text-fg hover:bg-fg/6",
					)}
					onClick={() => onToggle(item.key, !item.mine)}
				>
					<span aria-hidden="true">{REACTION_EMOJI[item.key]}</span>
					{item.count}
				</button>
			))}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<IconButton
						size="sm"
						variant="ghost"
						data-id="comment-add-reaction"
						label={t("collections.comments.addReaction")}
						icon={<IconMoodPlus size={16} aria-hidden="true" />}
					/>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					{COMMENT_REACTIONS.map((key) => (
						<DropdownMenuItem
							key={key}
							data-id="reaction-option"
							onSelect={() => onToggle(key, !given.get(key)?.mine)}
						>
							<span aria-hidden="true">{REACTION_EMOJI[key]}</span>{" "}
							{t(`collections.comments.reactions.${key}`)}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
