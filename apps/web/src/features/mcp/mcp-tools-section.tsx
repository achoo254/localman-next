import { type MockToolNode, mockToolEntries } from "@localman/shared/constants";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useId, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import type { McpTarget } from "./mcp-snippets";
import { McpToolList } from "./mcp-tool-list";
import { McpTryPanel } from "./mcp-try-panel";

const TRY_PANEL_ID = "mcp-try-panel";

export interface McpToolsSectionProps {
	resources: readonly MockToolNode[];
	target: McpTarget;
}

/**
 * "Generated tools": the tools of the enabled endpoints, read from the
 * project's resources (no extra request), and the "Try" disclosure.
 */
export function McpToolsSection({ resources, target }: McpToolsSectionProps) {
	const t = useT();
	const titleId = useId();
	const [tryOpen, setTryOpen] = useState(false);
	const entries = mockToolEntries(resources);
	return (
		<section
			data-id="project-detail-mcp-tools"
			aria-labelledby={titleId}
			className="grid gap-3"
		>
			<div className="flex flex-wrap items-center gap-2">
				<h3 id={titleId} className="m-0 font-mono font-semibold text-sm">
					{t("mcp.tools.title")}
				</h3>
				<Badge tone="primary">
					{entries.length}
					<span className="sr-only">
						{` ${t("mcp.tools.countUnit", { count: entries.length })}`}
					</span>
				</Badge>
				<Button
					size="sm"
					className="ml-auto"
					data-id="project-detail-mcp-try"
					aria-expanded={tryOpen}
					aria-controls={TRY_PANEL_ID}
					leadingIcon={<IconPlayerPlay size={16} aria-hidden="true" />}
					onClick={() => setTryOpen((open) => !open)}
				>
					{t("mcp.try.button")}
				</Button>
			</div>
			<McpTryPanel id={TRY_PANEL_ID} hidden={!tryOpen} target={target} />
			{entries.length > 0 ? (
				<McpToolList
					entries={entries}
					itemDataIdPrefix="mcp-tool-"
					className="md:grid-cols-2"
				/>
			) : (
				<p
					data-id="project-detail-mcp-tools-empty"
					className="m-0 text-muted text-sm"
				>
					{renderRich(
						t(resources.length > 0 ? "mcp.tools.allOff" : "mcp.tools.empty"),
					)}
				</p>
			)}
			<p className="m-0 text-[0.8125rem] text-muted">
				{renderRich(t("mcp.tools.footnote"))}
			</p>
		</section>
	);
}
