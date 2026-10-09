/**
 * Words for a route: the badge label and the sentence saying why the
 * router took it. Labels and reasons only; values never appear.
 */
import type { Translate } from "../../../i18n/translate";
import type { RouteInfo, SendRoute } from "../workbench/workbench-types";

export function routeBadgeLabel(
	route: SendRoute,
	routing: RouteInfo | undefined,
	t: Translate,
): string {
	if (route === "tunelo") return t("apiClientRouting.badge.tunelo");
	if (route === "direct") {
		return routing?.local
			? t("apiClientRouting.badge.local")
			: t("apiClientRouting.badge.direct");
	}
	const cors = routing?.why === "cors" || routing?.why === "remembered";
	return cors
		? t("apiClientRouting.badge.proxyCors")
		: t("apiClientRouting.badge.proxy");
}

/** Why the request went this way; empty for the proxy-only sender. */
export function routeWhy(
	route: SendRoute,
	routing: RouteInfo | undefined,
	t: Translate,
): string {
	if (!routing) return "";
	const { host } = routing;
	const via = t(
		`apiClientRouting.via.${route === "tunelo" ? "tunelo" : "proxy"}`,
	);
	switch (routing.why) {
		case "manual":
			return t(`apiClientRouting.why.manual.${route}`);
		case "direct":
			return routing.local
				? t("apiClientRouting.why.local", { host })
				: t("apiClientRouting.why.direct", { host });
		case "pinned":
			return t("apiClientRouting.why.pinned", { host });
		case "forbidden":
			return t("apiClientRouting.why.forbidden", {
				headers: routing.forbidden.join(", "),
				via,
			});
		case "redirects":
			return t("apiClientRouting.why.redirects", { via });
		case "remembered":
			return t("apiClientRouting.why.remembered", { host, via });
		case "cors":
			return t("apiClientRouting.why.cors", { host, via });
	}
}
