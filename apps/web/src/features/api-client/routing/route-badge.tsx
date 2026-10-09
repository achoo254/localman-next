import {
	IconHome,
	IconPlugConnected,
	IconTransfer,
	IconWorld,
} from "@tabler/icons-react";
import { Badge } from "../../../components/ui/badge";
import { Tooltip } from "../../../components/ui/tooltip";
import { useT } from "../../../i18n/i18n-context";
import type { RouteInfo, SendRoute } from "../workbench/workbench-types";
import { routeBadgeLabel, routeWhy } from "./route-why";

export interface RouteBadgeProps {
	route: SendRoute;
	routing?: RouteInfo;
	/** `data-id` of the badge (`response-route-badge` by default). */
	"data-id"?: string;
}

function routeIcon(route: SendRoute, routing: RouteInfo | undefined) {
	if (route === "tunelo") return IconPlugConnected;
	if (route === "proxy") return IconTransfer;
	return routing?.local ? IconHome : IconWorld;
}

/**
 * "Direct", "Via proxy", "Via Tunelo"…; why the router took that route is
 * in a tooltip (keyboard focusable) and, for screen readers, in the text.
 */
export function RouteBadge({
	route,
	routing,
	"data-id": dataId = "response-route-badge",
}: RouteBadgeProps) {
	const t = useT();
	const Icon = routeIcon(route, routing);
	const label = routeBadgeLabel(route, routing, t);
	const why = routeWhy(route, routing, t);
	const badge = (
		<Badge
			tone={route === "direct" ? "success" : "neutral"}
			data-id={dataId}
			data-route={route}
			tabIndex={why ? 0 : undefined}
		>
			<Icon size={12} aria-hidden="true" />
			{label}
			{why ? <span className="sr-only">{`: ${why}`}</span> : null}
		</Badge>
	);
	return why ? <Tooltip content={why}>{badge}</Tooltip> : badge;
}

/**
 * Compact route mark for lists (history): the route's icon with its name
 * for screen readers and as a hover title. Not focusable, so it fits
 * inside a row's button.
 */
export function RouteMark({ route }: { route: SendRoute }) {
	const t = useT();
	const Icon = routeIcon(route, undefined);
	const label = routeBadgeLabel(route, undefined, t);
	return (
		<span
			title={label}
			data-id="route-mark"
			data-route={route}
			className="inline-flex text-muted"
		>
			<Icon size={14} aria-hidden="true" />
			<span className="sr-only">{label}</span>
		</span>
	);
}
