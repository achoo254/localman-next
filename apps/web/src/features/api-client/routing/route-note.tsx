import { Alert } from "../../../components/ui/alert";
import { useT } from "../../../i18n/i18n-context";
import type { SendResult } from "../workbench/workbench-types";
import { routeWhy } from "./route-why";

/**
 * Note above a response when the route needs explaining: the router
 * switched on its own after a failed direct send, the browser left out
 * headers it may not send, or the user's tunnel asks for Basic Auth (it
 * took the request's `Authorization`). Nothing for an ordinary send.
 */
export function RouteNote({ result }: { result: SendResult }) {
	const t = useT();
	if (!result.routing?.tunnelBasicAuth)
		return <RouteSwitchNote result={result} />;
	return (
		<>
			<Alert
				tone="info"
				title={t("apiClientTunelo.accounts.basicAuth")}
				data-id="response-route-basic-auth"
			>
				<p className="m-0 text-xs">
					{t("apiClientTunelo.accounts.basicAuthBody")}
				</p>
			</Alert>
			<RouteSwitchNote result={result} />
		</>
	);
}

function RouteSwitchNote({ result }: { result: SendResult }) {
	const t = useT();
	const { route, routing } = result;
	if (!routing) return null;
	if (routing.why === "cors") {
		const via = t(
			`apiClientRouting.via.${route === "tunelo" ? "tunelo" : "proxy"}`,
		);
		return (
			<Alert
				tone="info"
				title={t("apiClientRouting.note.cors", { via })}
				data-id="response-route-note"
				data-route={route}
			>
				<p data-id="response-route-why" className="m-0 text-xs">
					{routeWhy(route, routing, t)}
				</p>
			</Alert>
		);
	}
	if (routing.dropped.length > 0) {
		return (
			<Alert
				tone="warning"
				title={t("apiClientRouting.note.dropped", {
					headers: routing.dropped.join(", "),
				})}
				data-id="response-route-note"
				data-route={route}
			>
				<p className="m-0 text-xs">{t("apiClientRouting.note.droppedHint")}</p>
			</Alert>
		);
	}
	return null;
}
