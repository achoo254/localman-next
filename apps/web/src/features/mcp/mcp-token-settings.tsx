import { IconRefresh } from "@tabler/icons-react";
import { type UseQueryResult, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import type { CopyFieldHandle } from "../../components/ui/copy-field";
import { Switch } from "../../components/ui/switch";
import { useToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { errorMessage } from "../../lib/api-client";
import type { Project } from "../../pages/projects/projects-api";
import {
	type McpTokenChange,
	type McpTokenStatus,
	mcpTokenQueryKey,
} from "./mcp-token-api";
import { type McpTokenDialog, McpTokenDialogs } from "./mcp-token-dialogs";
import { McpTokenReveal } from "./mcp-token-reveal";

type FocusTarget = "copy" | "switch" | "rotate";

const HELP = "m-0 text-[0.8125rem] text-muted";

export interface McpTokenSettingsProps {
	project: Project;
	/** Owner only; collaborators get a note instead. */
	query: UseQueryResult<McpTokenStatus>;
	tokenEnv: string;
}

/** "Require a token for MCP": switch, token hint, one-time token, rotation. */
export function McpTokenSettings({
	project,
	query,
	tokenEnv,
}: McpTokenSettingsProps) {
	const ids = useId();
	const queryClient = useQueryClient();
	const toast = useToast();
	const { t, formatDate } = useI18n();
	const [dialog, setDialog] = useState<McpTokenDialog | null>(null);
	const [revealed, setRevealed] = useState<string | null>(null);
	const copyRef = useRef<CopyFieldHandle>(null);
	const switchRef = useRef<HTMLButtonElement>(null);
	const rotateRef = useRef<HTMLButtonElement>(null);
	// Where focus goes once the modal closes or the reveal is dismissed.
	const focusAfter = useRef<FocusTarget | null>(null);

	const focus = (target: FocusTarget) => {
		if (target === "copy") copyRef.current?.focusCopyButton();
		else if (target === "rotate" && rotateRef.current)
			rotateRef.current.focus();
		else switchRef.current?.focus();
	};

	if (project.role !== "owner") {
		return (
			<section data-id="project-detail-mcp-token" className="grid gap-2">
				<h3 className="m-0 font-mono font-semibold text-sm">
					{t("mcp.token.title")}
				</h3>
				<p className={HELP}>{t("mcp.token.collaboratorNote")}</p>
			</section>
		);
	}

	const onChanged = (kind: McpTokenDialog, change: McpTokenChange) => {
		queryClient.setQueryData(mcpTokenQueryKey(project.id), change.status);
		if (change.issuedToken) {
			setRevealed(change.issuedToken);
			focusAfter.current = "copy";
			return;
		}
		focusAfter.current = "switch";
		if (kind !== "rotate") {
			toast.show({ title: t(`mcp.dialogs.${kind}.toast`) });
		}
	};

	const status = query.data;
	const titleId = `${ids}-title`;
	const helpId = `${ids}-help`;
	return (
		<section
			data-id="project-detail-mcp-token"
			aria-labelledby={titleId}
			className="grid gap-3"
		>
			<div className="flex items-center justify-between gap-3">
				<h3 id={titleId} className="m-0 font-mono font-semibold text-sm">
					{t("mcp.token.title")}
				</h3>
				{status ? (
					<Switch
						ref={switchRef}
						checked={status.required}
						aria-labelledby={titleId}
						aria-describedby={helpId}
						data-id="project-detail-mcp-token-toggle"
						onCheckedChange={() =>
							setDialog(status.required ? "disable" : "enable")
						}
					/>
				) : null}
			</div>
			{query.isPending ? (
				<output className={HELP}>{t("mcp.token.loading")}</output>
			) : null}
			{query.isError ? (
				<div className="grid justify-items-start gap-2">
					<Alert tone="danger" title={t("mcp.token.loadFailed")}>
						{errorMessage(query.error)}
					</Alert>
					<Button size="sm" onClick={() => void query.refetch()}>
						{t("common.cta.retry")}
					</Button>
				</div>
			) : null}
			{status && revealed ? (
				<McpTokenReveal
					token={revealed}
					tokenEnv={tokenEnv}
					copyRef={copyRef}
					onDismiss={() => {
						// The rotate button replaces the panel: render it, then focus it.
						flushSync(() => setRevealed(null));
						focus("rotate");
					}}
				/>
			) : null}
			{status?.required && status.token && !revealed ? (
				<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
					<p
						data-id="project-detail-mcp-token-hint"
						className="m-0 font-mono text-[0.8125rem]"
					>
						{t("mcp.token.hint", {
							last4: status.token.last4,
							created: formatDate(status.token.createdAt),
						})}
					</p>
					<Button
						ref={rotateRef}
						size="sm"
						data-id="project-detail-mcp-token-rotate"
						leadingIcon={<IconRefresh size={16} aria-hidden="true" />}
						onClick={() => setDialog("rotate")}
					>
						{t("mcp.token.rotate")}
					</Button>
				</div>
			) : null}
			{status ? (
				<p id={helpId} className={HELP}>
					{renderRich(
						t(status.required ? "mcp.token.helpOn" : "mcp.token.helpOff"),
					)}
				</p>
			) : null}
			{status ? (
				<McpTokenDialogs
					project={project}
					status={status}
					dialog={dialog}
					onClose={() => setDialog(null)}
					onChanged={onChanged}
					onCloseAutoFocus={(event) => {
						const target = focusAfter.current;
						focusAfter.current = null;
						if (!target) return;
						event.preventDefault();
						focus(target);
					}}
				/>
			) : null}
		</section>
	);
}
