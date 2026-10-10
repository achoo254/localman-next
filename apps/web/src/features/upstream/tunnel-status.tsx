import {
	IconAlertTriangle,
	IconCopy,
	IconInfoCircle,
	IconPlug,
} from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../../components/ui/button";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { copyText } from "../../platform/clipboard";
import { API_CLIENT_PATH } from "../api-client/open-in/open-in-state";

export interface TunnelStatusProps {
	port: number;
	/**
	 * The owner's tunnel URL of `localhost:<port>`: a string when mapped,
	 * `null` when not, `undefined` when not checked yet (an unsaved port).
	 */
	url: string | null | undefined;
	/** Prefix of the `data-id`s: `{scope}-tunnel-status`, `…-copy`. */
	scope: string;
}

type CopyState = "idle" | "copied" | "failed";

/**
 * Whether a local port has a Tunelo tunnel the mock can reach. Without
 * one, the command that opens it (with a copy button) and the way to map
 * it in the API client. Shared by the upstream, inboxes and callbacks.
 */
export function TunnelStatus({ port, url, scope }: TunnelStatusProps) {
	const t = useT();
	const { apiClient } = useFeatures();
	const [copy, setCopy] = useState<CopyState>("idle");
	const dataId = `${scope}-tunnel-status`;
	// Strings: a number parameter would be formatted as "3,000".
	const portText = String(port);
	if (url) {
		return (
			<p
				data-id={dataId}
				data-state="mapped"
				className="m-0 flex items-start gap-1 text-muted text-sm"
			>
				<IconPlug
					size={16}
					aria-hidden="true"
					className="mt-0.5 flex-none text-success"
				/>
				<span className="min-w-0 wrap-anywhere">
					{renderRich(t("upstream.tunnel.mapped", { port: portText, url }))}
				</span>
			</p>
		);
	}
	const missing = url === null;
	const Icon = missing ? IconAlertTriangle : IconInfoCircle;
	const command = `tunelo http ${port}`;
	const text = t(
		missing ? "upstream.tunnel.missing" : "upstream.tunnel.unchecked",
		{
			port: portText,
		},
	);
	return (
		<div
			data-id={dataId}
			data-state={missing ? "missing" : "unchecked"}
			className="grid justify-items-start gap-2 text-muted text-sm"
		>
			<p className="m-0 flex items-start gap-1">
				<Icon
					size={16}
					aria-hidden="true"
					className={
						missing ? "mt-0.5 flex-none text-warning" : "mt-0.5 flex-none"
					}
				/>
				<span className="min-w-0 wrap-anywhere">
					{renderRich(text, {
						link: (chunk) =>
							apiClient ? (
								<Link to={API_CLIENT_PATH} className="font-semibold">
									{chunk}
								</Link>
							) : (
								chunk
							),
					})}
				</span>
			</p>
			<Button
				size="sm"
				data-id={`${dataId}-copy`}
				leadingIcon={<IconCopy size={16} aria-hidden="true" />}
				onClick={() => {
					void copyText(command).then((ok) =>
						setCopy(ok ? "copied" : "failed"),
					);
				}}
			>
				{copy === "copied"
					? t("common.actions.copied")
					: t("upstream.tunnel.copy")}
			</Button>
			<output
				aria-live="polite"
				className={copy === "failed" ? "text-xs" : "sr-only"}
			>
				{copy === "copied"
					? t("common.actions.copied")
					: copy === "failed"
						? t("upstream.tunnel.copyFailed", { command })
						: ""}
			</output>
		</div>
	);
}
