import { Badge } from "../../components/ui/badge";
import { CodeBlock } from "../../components/ui/code-block";
import { useT } from "../../i18n/i18n-context";
import { type LogHeader, type LogMessage, REDACTED } from "./request-log-parse";

export const DETAIL_TITLE = "m-0 font-mono font-semibold text-muted text-xs";

/** `X-Request-Id` → `x-request-id`, for `data-id`s. */
export function headerSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** JSON bodies indented; anything else (or a cut body) as stored. */
export function prettyBody(body: string, truncated: boolean): string {
	const text = body.trim();
	if (truncated || !(text.startsWith("{") || text.startsWith("["))) return body;
	try {
		return JSON.stringify(JSON.parse(text), null, 2);
	} catch {
		return body;
	}
}

export interface LogHeadersProps {
	title: string;
	headers: readonly LogHeader[];
}

/** Headers in order; masked ones read `[redacted]` with a "masked" badge. */
export function LogHeaders({ title, headers }: LogHeadersProps) {
	const t = useT();
	if (headers.length === 0) {
		return (
			<p className="m-0 text-muted text-sm">
				{t("trafficLog.detail.noHeaders")}
			</p>
		);
	}
	return (
		<div className="min-w-0 overflow-x-auto">
			<table className="w-full border-collapse text-sm">
				<caption className="sr-only">{title}</caption>
				<thead>
					<tr>
						<th
							scope="col"
							className="px-2 py-1 text-left font-mono text-muted text-xs"
						>
							{t("trafficLog.detail.header")}
						</th>
						<th
							scope="col"
							className="px-2 py-1 text-left font-mono text-muted text-xs"
						>
							{t("trafficLog.detail.value")}
						</th>
					</tr>
				</thead>
				<tbody>
					{headers.map((header, index) => (
						<tr
							key={`${header.name}-${index}`}
							data-id={`request-log-header-${headerSlug(header.name)}`}
							className="border-border-subtle border-t"
						>
							<td className="whitespace-nowrap px-2 py-1 align-top font-mono">
								{header.name}
							</td>
							<td className="px-2 py-1 align-top font-mono wrap-anywhere">
								{header.value}
								{header.value === REDACTED ? (
									<Badge className="ml-2">
										{t("trafficLog.detail.masked")}
									</Badge>
								) : null}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export interface LogBodyProps {
	caption: string;
	message: LogMessage;
	"data-id": string;
}

/** A body as text (long ones scroll in place), or a note for binary ones. */
export function LogBody({ caption, message, "data-id": dataId }: LogBodyProps) {
	const t = useT();
	if (message.body === "" && message.size === 0) return null;
	if (message.bodyEncoding === "base64") {
		return (
			<p data-id={dataId} className="m-0 text-muted text-sm">
				{t("trafficLog.detail.binary", { caption, size: message.size })}
			</p>
		);
	}
	return (
		<div className="grid gap-1">
			<div className="max-h-72 min-w-0 overflow-y-auto rounded-md">
				<CodeBlock
					caption={caption}
					code={prettyBody(message.body, message.truncated)}
					data-id={dataId}
				/>
			</div>
			{message.truncated ? (
				<p className="m-0 text-muted text-xs">
					{t("trafficLog.detail.truncated", { size: message.size })}
				</p>
			) : null}
		</div>
	);
}
