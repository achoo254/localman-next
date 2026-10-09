import { IconExternalLink } from "@tabler/icons-react";
import { CodeBlock } from "../../components/ui/code-block";
import { ExternalLink } from "../../components/ui/external-link";
import { useT } from "../../i18n/i18n-context";
import {
	INSPECTOR_DOCS_URL,
	type McpTarget,
	inspectorCliCommand,
	inspectorCommand,
} from "./mcp-snippets";
import { ShellHint } from "./shell-hint";

export interface McpTryPanelProps {
	/** Target of the "Try" button's `aria-controls`. */
	id: string;
	hidden: boolean;
	target: McpTarget;
}

/**
 * Commands that run MCP Inspector on the user's machine. Nothing is called
 * from the browser: the Inspector web UI guards itself with a per-run
 * token, so a link from Localman could not open it pre-filled.
 */
export function McpTryPanel({ id, hidden, target }: McpTryPanelProps) {
	const t = useT();
	return (
		<div
			id={id}
			hidden={hidden}
			data-id="project-detail-mcp-try-panel"
			className="grid gap-3 rounded-md border border-border-subtle p-4"
		>
			<p className="m-0 text-sm">{t("mcp.try.intro")}</p>
			<CodeBlock
				wrap
				caption={t("mcp.try.commandCaption")}
				code={inspectorCommand(target)}
				data-id="project-detail-mcp-try-command"
			/>
			<CodeBlock
				wrap
				caption={t("mcp.try.cliCaption")}
				code={inspectorCliCommand(target)}
				data-id="project-detail-mcp-try-cli"
			/>
			{target.tokenEnv ? (
				<ShellHint
					tokenEnv={target.tokenEnv}
					id="project-detail-mcp-try-shell"
				/>
			) : null}
			<p className="m-0 text-[0.8125rem] text-muted">
				{t("mcp.try.quota")}{" "}
				<ExternalLink
					href={INSPECTOR_DOCS_URL}
					data-id="project-detail-mcp-try-docs"
					className="inline-flex items-center gap-1 text-primary"
				>
					{t("mcp.try.docs")}
					<IconExternalLink size={14} aria-hidden="true" />
					<span className="sr-only">{` ${t("common.opensInNewTab")}`}</span>
				</ExternalLink>
			</p>
		</div>
	);
}
