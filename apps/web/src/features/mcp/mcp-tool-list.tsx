import type {
	MockToolAction,
	MockToolEntry,
	MockToolNode,
} from "@localman/shared/constants";
import { Badge, type BadgeTone } from "../../components/ui/badge";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { MCP_PARENT_PARAM, MCP_TOOL_PARAMS } from "./mcp-copy";

const BADGES: Partial<
	Record<
		MockToolAction,
		{ label: "mcp.tools.readOnly" | "mcp.tools.destructive"; tone: BadgeTone }
	>
> = {
	list: { label: "mcp.tools.readOnly", tone: "neutral" },
	get: { label: "mcp.tools.readOnly", tone: "neutral" },
	delete: { label: "mcp.tools.destructive", tone: "danger" },
};

export interface McpToolListProps {
	/** From `mockToolEntries`, the naming shared with the MCP server. */
	entries: readonly MockToolEntry<MockToolNode>[];
	/** Prefix of each item's `data-id`, followed by the tool name. */
	itemDataIdPrefix: string;
	/** Column classes, e.g. `md:grid-cols-2`; one column by default. */
	className?: string;
}

/** Tool names with their arguments and a read-only/destructive badge. */
export function McpToolList({
	entries,
	itemDataIdPrefix,
	className,
}: McpToolListProps) {
	const t = useT();
	return (
		<ul className={cn("m-0 grid list-none gap-2 p-0", className)}>
			{entries.map((entry) => {
				const badge = BADGES[entry.action];
				const params =
					(entry.ancestors.length > 0 ? MCP_PARENT_PARAM : "") +
					(entry.action === "create"
						? t("mcp.tools.createParams")
						: MCP_TOOL_PARAMS[entry.action]);
				return (
					<li
						key={entry.name}
						data-id={`${itemDataIdPrefix}${entry.name}`}
						className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-sm border border-border-subtle px-2 py-1.5"
					>
						<code className="font-semibold text-[0.8125rem]">{entry.name}</code>
						<span className="text-muted text-xs">{params}</span>
						{badge ? (
							<Badge tone={badge.tone} className="ml-auto">
								{t(badge.label)}
							</Badge>
						) : null}
					</li>
				);
			})}
		</ul>
	);
}
