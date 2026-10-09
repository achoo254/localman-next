import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";

export interface ShellHintProps {
	/** Variable the command reads the token from. */
	tokenEnv: string;
	/** `data-id` of the note. */
	id: string;
}

/** How other shells than bash/zsh read the token variable of a command. */
export function ShellHint({ tokenEnv, id }: ShellHintProps) {
	const t = useT();
	return (
		<p data-id={id} className="m-0 text-[0.8125rem] text-muted">
			{renderRich(t("mcp.config.shellHint", { env: tokenEnv }))}
		</p>
	);
}
