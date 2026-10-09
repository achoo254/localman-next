import type { Ref } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import {
	CopyField,
	type CopyFieldHandle,
} from "../../components/ui/copy-field";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";

export interface McpTokenRevealProps {
	token: string;
	tokenEnv: string;
	copyRef: Ref<CopyFieldHandle>;
	onDismiss: () => void;
}

/**
 * The token just created, shown once: it lives only in component state,
 * never in the query cache, and is gone once dismissed or the page is left.
 * No automatic copy, so the clipboard is filled only on purpose.
 */
export function McpTokenReveal({
	token,
	tokenEnv,
	copyRef,
	onDismiss,
}: McpTokenRevealProps) {
	const t = useT();
	return (
		<Alert
			tone="warning"
			title={t("mcp.token.revealTitle")}
			data-id="project-detail-mcp-token-reveal"
		>
			<div className="mt-2 grid justify-items-start gap-3">
				<div className="w-full">
					<CopyField
						ref={copyRef}
						label={t("mcp.token.revealLabel")}
						itemLabel={t("mcp.token.revealItem")}
						value={token}
						hint={renderRich(t("mcp.token.revealHint", { env: tokenEnv }))}
						data-id="project-detail-mcp-token-value"
						copyDataId="project-detail-mcp-token-copy"
					/>
				</div>
				<Button
					variant="ghost"
					size="sm"
					data-id="project-detail-mcp-token-dismiss"
					onClick={onDismiss}
				>
					{t("mcp.token.revealDismiss")}
				</Button>
			</div>
		</Alert>
	);
}
