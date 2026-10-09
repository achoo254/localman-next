import { useT } from "../../../i18n/i18n-context";
import { renderRich } from "../../../i18n/rich-text";
import type { SendRoute } from "../workbench/workbench-types";
import { CELL } from "./response-headers-table";
import type { ParsedCookie } from "./set-cookie-parser";

export interface ResponseCookiesTableProps {
	cookies: readonly ParsedCookie[];
	route: SendRoute;
}

/** Cookies set by the response (display only, never applied). */
export function ResponseCookiesTable({
	cookies,
	route,
}: ResponseCookiesTableProps) {
	const t = useT();
	if (cookies.length === 0) {
		return route === "direct" ? (
			<p
				data-id="response-cookies-direct"
				className="m-0 p-4 text-muted text-sm"
			>
				{renderRich(t("apiClientTools.response.cookies.direct"))}
			</p>
		) : (
			<p className="m-0 p-4 text-muted text-sm">
				{t("apiClientTools.response.cookies.empty")}
			</p>
		);
	}
	const flag = (on: boolean): string =>
		on
			? t("apiClientTools.response.cookies.yes")
			: t("apiClientTools.response.cookies.no");
	const expiry = (cookie: ParsedCookie): string => {
		if (cookie.maxAge !== null) {
			return t("apiClientTools.response.cookies.maxAge", {
				seconds: cookie.maxAge,
			});
		}
		return cookie.expires ?? t("apiClientTools.response.cookies.session");
	};
	const columns = [
		t("apiClientTools.response.cookies.name"),
		t("apiClientTools.response.cookies.value"),
		t("apiClientTools.response.cookies.domain"),
		t("apiClientTools.response.cookies.path"),
		t("apiClientTools.response.cookies.expires"),
		t("apiClientTools.response.cookies.httpOnly"),
		t("apiClientTools.response.cookies.secure"),
	];
	return (
		<div className="overflow-x-auto p-4">
			<table
				data-id="response-cookies"
				className="w-full min-w-140 border-collapse"
			>
				<thead>
					<tr>
						{columns.map((column) => (
							<th key={column} scope="col" className={`${CELL} text-muted`}>
								{column}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{cookies.map((cookie, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: the same name may be set twice.
						<tr key={index}>
							<td className={`${CELL} font-semibold`}>{cookie.name}</td>
							<td className={`${CELL} break-all`}>{cookie.value}</td>
							<td className={CELL}>{cookie.domain}</td>
							<td className={CELL}>{cookie.path}</td>
							<td className={CELL}>{expiry(cookie)}</td>
							<td className={CELL}>{flag(cookie.httpOnly)}</td>
							<td className={CELL}>{flag(cookie.secure)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
