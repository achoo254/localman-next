import type { AffectedNode } from "@localman/shared/api-client";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

const TONE = {
	added: "text-success-text",
	removed: "text-error-text",
	changed: "text-fg",
} as const;

/** The folders, requests and examples a "Restore to this change" rewrote. */
export function AffectedNodes({ nodes }: { nodes: readonly AffectedNode[] }) {
	const t = useT();
	if (nodes.length === 0) return null;
	return (
		<section
			aria-label={t("collections.changelog.affected.title")}
			data-id="changelog-affected"
			className="grid gap-1"
		>
			<h4 className="m-0 font-semibold text-xs">
				{t("collections.changelog.affected.title")}
			</h4>
			<ul className="m-0 grid list-none gap-0.5 p-0 text-xs">
				{nodes.map((node) => (
					<li key={node.nodeId} className={cn(TONE[node.change])}>
						{t(`collections.changelog.affected.${node.change}`, {
							name: node.name ?? t("collections.changelog.affected.unnamed"),
						})}
					</li>
				))}
			</ul>
		</section>
	);
}
