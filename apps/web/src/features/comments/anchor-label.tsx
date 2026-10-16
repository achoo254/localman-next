import type { CommentAnchor } from "@localman/shared/api-client";
import { useT } from "../../i18n/i18n-context";

/** Where an inline comment points: "Header · value · “application”". */
export function AnchorLabel({ anchor }: { anchor: CommentAnchor }) {
	const t = useT();
	const parts = [t(`collections.comments.anchor.${anchor.part}`)];
	if (anchor.field)
		parts.push(t(`collections.comments.anchor.${anchor.field}`));
	return (
		<span
			data-id="comment-anchor"
			className="flex min-w-0 items-center gap-1 text-muted text-xs"
		>
			<span className="flex-none">{parts.join(" · ")}</span>
			<code className="min-w-0 truncate rounded-sm bg-fg/6 px-1 font-mono text-fg">
				{anchor.quote}
			</code>
		</span>
	);
}
