import { useId, useState } from "react";
import { CodeBlock } from "../../components/ui/code-block";
import {
	SegmentedControl,
	type SegmentedOption,
} from "../../components/ui/segmented-control";
import { CodeSpans } from "./code-spans";
import { MCP_CONFIG_LABELS, MCP_COPY } from "./mcp-copy";
import {
	MCP_CONFIG_FORMATS,
	type McpConfigFormat,
	type McpTarget,
	mcpConfigSnippet,
} from "./mcp-snippets";
import { ShellHint } from "./shell-hint";

const OPTIONS: readonly SegmentedOption<McpConfigFormat>[] =
	MCP_CONFIG_FORMATS.map((format) => ({
		value: format,
		label: MCP_CONFIG_LABELS[format].label,
		"data-id": `project-detail-mcp-config-${format}`,
	}));

/** Whether calls need the token: unknown to collaborators and while loading. */
export type McpTokenMode = "off" | "on" | "unknown";

function hintOf(mode: McpTokenMode, tokenEnv: string | null): string {
	if (mode === "on" && tokenEnv) return MCP_COPY.configHintOn(tokenEnv);
	if (mode === "off") return MCP_COPY.configHintOff;
	return MCP_COPY.configHintUnknown;
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
	const titleId = useId();
	const [format, setFormat] = useState<McpConfigFormat>("claude");
	return (
		<section aria-labelledby={titleId} className="grid gap-3">
			<h3 id={titleId} className="m-0 font-mono font-semibold text-sm">
				{MCP_COPY.configTitle}
			</h3>
			<SegmentedControl
				legend={MCP_COPY.configLegend}
				data-id="project-detail-mcp-config"
				options={OPTIONS}
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
				<CodeSpans text={hintOf(tokenMode, target.tokenEnv)} />
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
