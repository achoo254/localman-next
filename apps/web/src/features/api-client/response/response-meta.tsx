import type { ClientResponse } from "@localman/shared/api-client";
import {
	IconPlugConnected,
	IconTransfer,
	IconWorld,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Badge } from "../../../components/ui/badge";
import { useI18n } from "../../../i18n/i18n-context";
import type { SendRoute } from "../workbench/workbench-types";
import { formatBytes, statusTone } from "./response-content";
import { TimingsPopover } from "./timings-popover";

export interface ResponseMetaProps {
	response: ClientResponse;
	route: SendRoute;
	routeBadge?: ReactNode;
}

const ROUTE_ICONS = {
	direct: IconWorld,
	proxy: IconTransfer,
	tunelo: IconPlugConnected,
} as const;

/** Route badge, status (toned by class), time with timings, and size. */
export function ResponseMeta({
	response,
	route,
	routeBadge,
}: ResponseMetaProps) {
	const { t, formatNumber } = useI18n();
	const RouteIcon = ROUTE_ICONS[route];
	return (
		<div
			data-id="response-meta"
			className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 font-mono text-xs"
		>
			{routeBadge ?? (
				<Badge tone="neutral" data-id="response-route-badge" data-route={route}>
					<RouteIcon size={12} aria-hidden="true" />
					{t(`apiClientTools.response.route.${route}`)}
				</Badge>
			)}
			<Badge tone={statusTone(response.status)} data-id="response-status">
				<span className="sr-only">
					{t("apiClientTools.response.meta.status")}{" "}
				</span>
				{`${response.status} ${response.statusText}`.trim()}
			</Badge>
			<TimingsPopover response={response} route={route} />
			<span data-id="response-size" className="text-muted">
				<span className="sr-only">
					{t("apiClientTools.response.meta.size")}{" "}
				</span>
				{formatBytes(response.size, formatNumber)}
			</span>
		</div>
	);
}
