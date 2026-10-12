import {
	ROUTE_MODES,
	type RouteMode,
	looksLikeCurl,
} from "@localman/shared/api-client";
import { IconSend } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { useT } from "../../../i18n/i18n-context";
import { TunnelBadge } from "../tunelo/tunnel-badge";
import { newId } from "../workbench/workbench-ids";
import { CurlImportModal } from "./curl-import-modal";
import type { DraftPaneProps } from "./draft-pane";
import { MethodSelect } from "./method-select";
import { paramsFromUrl } from "./params-sync";
import { VariableInput } from "./variable-input";

export interface UrlBarProps extends DraftPaneProps {
	sending: boolean;
	onSend: () => void;
}

function isRouteMode(value: string): value is RouteMode {
	return ROUTE_MODES.some((mode) => mode === value);
}

/**
 * Method, URL (query mirrored in Params, "Via Tunelo" when a mapping
 * applies), route and Send.
 */
export function UrlBar({ draft, update, sending, onSend }: UrlBarProps) {
	const t = useT();
	const [pastedCurl, setPastedCurl] = useState<string | null>(null);
	return (
		<div className="flex flex-wrap items-stretch gap-2 @2xl:flex-nowrap">
			<div className="flex min-w-0 flex-1 basis-full items-stretch rounded-md border border-border-strong bg-surface transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-focus-primary @2xl:basis-auto">
				<MethodSelect
					value={draft.method}
					onChange={(method) => update((current) => ({ ...current, method }))}
				/>
				<VariableInput
					variant="bare"
					value={draft.url}
					aria-label={t("apiClient.request.url")}
					placeholder={t("apiClient.request.urlPlaceholder")}
					data-id="request-url"
					onValueChange={(url) =>
						update((current) => ({
							...current,
							url,
							params: paramsFromUrl(url, current.params, newId),
						}))
					}
					onPaste={(event) => {
						const text = event.clipboardData.getData("text/plain");
						if (!looksLikeCurl(text)) return;
						event.preventDefault();
						setPastedCurl(text);
					}}
				/>
				<TunnelBadge url={draft.url} mode={draft.settings.route} />
			</div>
			<select
				value={draft.settings.route}
				aria-label={t("apiClient.request.route")}
				data-id="request-route"
				className="min-h-11 flex-1 cursor-pointer rounded-md border border-border-strong bg-surface px-3 font-mono text-sm @2xl:flex-none"
				onChange={(event) => {
					const route = event.target.value;
					if (!isRouteMode(route)) return;
					update((current) => ({
						...current,
						settings: { ...current.settings, route },
					}));
				}}
			>
				{ROUTE_MODES.map((mode) => (
					<option key={mode} value={mode}>
						{t(`apiClient.request.routes.${mode}`)}
					</option>
				))}
			</select>
			<Button
				variant="primary"
				data-id="request-send"
				className="flex-1 @2xl:flex-none"
				loading={sending}
				aria-keyshortcuts="Control+Enter Meta+Enter"
				onClick={onSend}
			>
				<IconSend size={16} aria-hidden="true" />
				{t("apiClient.request.send")}
			</Button>
			<CurlImportModal
				command={pastedCurl}
				onClose={() => setPastedCurl(null)}
				onImport={(imported) => update(() => imported)}
			/>
		</div>
	);
}
