import type { CollectionTree } from "@localman/shared/api-client";
import { useT } from "../../i18n/i18n-context";
import { MarkdownView } from "../collections/markdown-view";
import { AuthView, PublishedValue, ViewSection } from "./public-request-parts";

/**
 * What a published collection shows before a request is picked: its
 * description, auth and variables (secret ones read "hidden").
 */
export function PublicCollectionOverview({
	description,
	tree,
}: {
	description: string;
	tree: CollectionTree;
}) {
	const t = useT();
	return (
		<article className="grid min-w-0 gap-6" data-id="public-overview">
			<h2 className="m-0 font-bold font-mono text-lg">
				{t("publicSharing.view.page.overview")}
			</h2>
			{description.trim() !== "" ? <MarkdownView source={description} /> : null}
			<ViewSection title={t("publicSharing.view.request.auth")}>
				<AuthView auth={tree.auth} />
			</ViewSection>
			<ViewSection
				title={t("publicSharing.view.page.variables")}
				data-id="public-variables"
			>
				{tree.variables.length > 0 ? (
					<dl className="m-0 grid gap-1 text-sm">
						{tree.variables.map((variable, index) => (
							<div
								// Keys may repeat; the order is the file's.
								key={`${variable.key}-${index}`}
								className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 border-border-subtle border-b py-1.5 last:border-b-0"
							>
								<dt className="break-all font-mono text-[0.8125rem]">
									{variable.key}
									{variable.enabled === false ? (
										<span className="ml-2 text-muted">
											{t("publicSharing.view.request.disabled")}
										</span>
									) : null}
								</dt>
								<dd className="m-0 min-w-0">
									<PublishedValue
										value={variable.value}
										credential={variable.secret === true}
									/>
								</dd>
							</div>
						))}
					</dl>
				) : (
					<p className="m-0 text-muted text-sm">
						{t("publicSharing.view.page.noVariables")}
					</p>
				)}
			</ViewSection>
		</article>
	);
}
