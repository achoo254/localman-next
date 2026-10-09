import { useId, useState } from "react";
import { CodeBlock } from "../../components/ui/code-block";
import {
	SegmentedControl,
	type SegmentedOption,
} from "../../components/ui/segmented-control";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import type { Translate } from "../../i18n/translate";
import { MCP_CONFIG_LABELS } from "./mcp-copy";
import {
	MCP_CONFIG_FORMATS,
	type McpConfigFormat,
	type McpTarget,
	mcpConfigSnippet,
} from "./mcp-snippets";
import { ShellHint } from "./shell-hint";

function optionsOf(t: Translate): readonly SegmentedOption<McpConfigFormat>[] {
	return MCP_CONFIG_FORMATS.map((format) => ({
		value: format,
		label: MCP_CONFIG_LABELS[format].label ?? t("mcp.config.jsonLabel"),
		"data-id": `project-detail-mcp-config-${format}`,
	}));
}

/** Whether calls need the token: unknown to collaborators and while loading. */
export type McpTokenMode = "off" | "on" | "unknown";

function hintOf(
	mode: McpTokenMode,
	tokenEnv: string | null,
	t: Translate,
): string {
	if (mode === "on" && tokenEnv) {
		return t("mcp.config.hintOn", { env: tokenEnv });
	}
	if (mode === "off") return t("mcp.config.hintOff");
	return t("mcp.config.hintUnknown");
}

export interface McpConfigSnippetsProps {
	target: McpTarget;
	tokenMode: McpTokenMode;
}

/** Claude Code / Cursor / generic JSON configuration with a copy button. */
export function McpConfigSnippets({
	target,
	tokenMode,
}: McpConfigSnippetsProps) {
	const t = useT();
	const titleId = useId();
	const [format, setFormat] = useState<McpConfigFormat>("claude");
	return (
		<section aria-labelledby={titleId} className="grid gap-3">
			<h3 id={titleId} className="m-0 font-mono font-semibold text-sm">
				{t("mcp.config.title")}
			</h3>
			<SegmentedControl
				legend={t("mcp.config.legend")}
				data-id="project-detail-mcp-config"
				options={optionsOf(t)}
				value={format}
				onChange={setFormat}
			/>
			<CodeBlock
				caption={MCP_CONFIG_LABELS[format].caption}
				code={mcpConfigSnippet(format, target)}
				// Shell commands stay one line when copied; JSON scrolls.
				wrap={format === "claude"}
				data-id="project-detail-mcp-config-output"
			/>
			<p
				data-id="project-detail-mcp-config-hint"
				className="m-0 text-[0.8125rem] text-muted"
			>
				{renderRich(hintOf(tokenMode, target.tokenEnv, t))}
			</p>
			{format === "claude" && target.tokenEnv ? (
				<ShellHint
					tokenEnv={target.tokenEnv}
					id="project-detail-mcp-config-shell"
				/>
			) : null}
		</section>
	);
}
