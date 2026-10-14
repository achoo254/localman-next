import type {
	ImportedExample,
	ImportedRequest,
} from "@localman/shared/api-client";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { METHOD_TEXT_CLASS } from "../../lib/method-tone";
import { MarkdownView } from "../collections/markdown-view";
import {
	AuthView,
	BodyView,
	KeyValueList,
	ViewSection,
} from "./public-request-parts";

function ExampleView({ example }: { example: ImportedExample }) {
	const t = useT();
	const { response } = example;
	return (
		<li
			data-id="public-example"
			className="grid gap-2 rounded-md border border-border-subtle p-3"
		>
			<p className="m-0 flex flex-wrap items-baseline gap-2">
				<b className="break-words text-sm">{example.name}</b>
				<span className="font-mono text-muted text-[0.8125rem]">
					{t("publicSharing.view.request.exampleStatus", {
						status: `${response.status} ${response.statusText}`.trim(),
					})}
				</span>
			</p>
			{response.headers.length > 0 ? (
				<KeyValueList rows={response.headers} />
			) : null}
		</li>
	);
}

/**
 * A request of a published collection, read-only: method, URL, params,
 * headers, auth (blanked credentials read "hidden"), body, description
 * (Markdown built as React elements, never HTML) and examples without
 * their response bodies.
 */
export function PublicRequestView({ request }: { request: ImportedRequest }) {
	const t = useT();
	const { draft } = request;
	return (
		<article className="grid min-w-0 gap-6" data-id="public-request">
			<header className="grid gap-2">
				<h2 className="m-0 break-words font-bold font-mono text-lg">
					{request.name}
				</h2>
				<p className="m-0 flex min-w-0 items-baseline gap-2 rounded-md border border-border bg-surface-subtle px-3 py-2">
					<span
						className={cn(
							"flex-none font-bold font-mono text-sm",
							METHOD_TEXT_CLASS[draft.method],
						)}
					>
						{draft.method}
					</span>
					<span
						className="min-w-0 break-all font-mono text-[0.8125rem]"
						data-id="public-request-url"
					>
						{draft.url}
					</span>
				</p>
			</header>
			{request.description.trim() !== "" ? (
				<ViewSection title={t("publicSharing.view.request.description")}>
					<MarkdownView source={request.description} />
				</ViewSection>
			) : null}
			{draft.params.length > 0 ? (
				<ViewSection
					title={t("publicSharing.view.request.params")}
					data-id="public-request-params"
				>
					<KeyValueList rows={draft.params} />
				</ViewSection>
			) : null}
			{draft.headers.length > 0 ? (
				<ViewSection
					title={t("publicSharing.view.request.headers")}
					data-id="public-request-headers"
				>
					<KeyValueList rows={draft.headers} />
				</ViewSection>
			) : null}
			<ViewSection
				title={t("publicSharing.view.request.auth")}
				data-id="public-request-auth"
			>
				<AuthView auth={draft.auth} />
			</ViewSection>
			<ViewSection title={t("publicSharing.view.request.body")}>
				<BodyView body={draft.body} />
			</ViewSection>
			<ViewSection
				title={t("publicSharing.view.request.examples")}
				data-id="public-request-examples"
			>
				{request.examples.length > 0 ? (
					<>
						<p className="m-0 text-muted text-[0.8125rem]">
							{t("publicSharing.view.request.exampleBodyHidden")}
						</p>
						<ul className="m-0 grid list-none gap-2 p-0">
							{request.examples.map((example) => (
								<ExampleView key={example.id} example={example} />
							))}
						</ul>
					</>
				) : (
					<p className="m-0 text-muted text-sm">
						{t("publicSharing.view.request.noExamples")}
					</p>
				)}
			</ViewSection>
		</article>
	);
}
