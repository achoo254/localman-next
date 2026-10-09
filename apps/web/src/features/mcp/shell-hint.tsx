import { CodeSpans } from "./code-spans";
import { MCP_COPY } from "./mcp-copy";

export interface ShellHintProps {
	/** Variable the command reads the token from. */
	tokenEnv: string;
	/** `data-id` of the note. */
	id: string;
}

/** How other shells than bash/zsh read the token variable of a command. */
export function ShellHint({ tokenEnv, id }: ShellHintProps) {
	return (
		<p data-id={id} className="m-0 text-[0.8125rem] text-muted">
			<CodeSpans text={MCP_COPY.shellHint(tokenEnv)} />
		</p>
	);
}
