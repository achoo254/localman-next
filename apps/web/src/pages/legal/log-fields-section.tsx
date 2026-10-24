import { brand } from "@localman/shared/brand";
import {
	PROXY_LOG_FIELDS,
	REQUEST_LOG_FIELDS,
	WEB_SERVER_LOG_FIELDS,
} from "@localman/shared/data-policy";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";

type LogKind = "proxyLog" | "serverLog" | "webServerLog";

/**
 * "What the proxy / the server / the web server logs": the exact fields of
 * one log line, listed from the data policy the API's tests hold the code to.
 */
export function LogFieldsSection({ kind }: { kind: LogKind }) {
	const t = useT();
	const app = brand.appName;
	const titleId = `your-data-${kind}-title`;
	const views = {
		proxyLog: {
			body: t("dataTransparency.proxyLog.body"),
			fields: PROXY_LOG_FIELDS.map((field) => ({
				field,
				label: t(`dataTransparency.proxyLog.fields.${field}`),
			})),
		},
		serverLog: {
			body: t("dataTransparency.serverLog.body", { app }),
			fields: REQUEST_LOG_FIELDS.map((field) => ({
				field,
				label: t(`dataTransparency.serverLog.fields.${field}`),
			})),
		},
		webServerLog: {
			body: t("dataTransparency.webServerLog.body", { app }),
			fields: WEB_SERVER_LOG_FIELDS.map((field) => ({
				field,
				label: t(`dataTransparency.webServerLog.fields.${field}`),
			})),
		},
	};
	const { body, fields } = views[kind];
	return (
		<section
			aria-labelledby={titleId}
			data-id={`your-data-${kind}`}
			className="grid gap-2"
		>
			<h2 id={titleId} className="m-0 font-bold font-mono text-base">
				{t(`dataTransparency.${kind}.title`)}
			</h2>
			<p className="m-0">{body}</p>
			<ul className="m-0 grid gap-1 pl-5">
				{fields.map(({ field, label }) => (
					<li key={field}>
						{renderRich(t("dataTransparency.fieldLine", { field, label }))}
					</li>
				))}
			</ul>
		</section>
	);
}
