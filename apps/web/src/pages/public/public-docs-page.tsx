import { Navigate, useParams } from "react-router";
import { PageLoading } from "../../components/layout/page-loading";
import { Badge } from "../../components/ui/badge";
import { useFeatures } from "../../config/features";
import type {
	DocsField,
	DocsResource,
	ProjectDocs,
} from "../../features/project-docs/project-docs-api";
import { usePublicDocs } from "../../features/project-docs/use-project-docs";
import { PublicViewError } from "../../features/public-sharing/public-view-error";
import { useT } from "../../i18n/i18n-context";
import { useAppTitle } from "../../lib/use-document-title";

function FieldRow({ field }: { field: DocsField }) {
	return (
		<tr className="border-border-subtle border-t">
			<td className="py-1.5 pr-3 font-mono text-xs">{field.name}</td>
			<td className="py-1.5 pr-3 text-xs">{field.type}</td>
			<td className="py-1.5 font-mono text-muted text-xs">
				{field.detail ?? ""}
			</td>
		</tr>
	);
}

function ResourceSection({ resource }: { resource: DocsResource }) {
	const t = useT();
	return (
		<section
			data-id="public-docs-resource"
			aria-labelledby={`docs-${resource.name}`}
			className="grid gap-3 rounded-lg border border-border p-4"
		>
			<h2
				id={`docs-${resource.name}`}
				className="m-0 font-mono font-semibold text-lg"
			>
				{resource.name}
			</h2>
			<div className="grid gap-1">
				<h3 className="m-0 font-semibold text-sm">
					{t("projectDocs.page.endpoints")}
				</h3>
				<ul className="m-0 grid list-none gap-1 p-0">
					{resource.endpoints.map((endpoint) => (
						<li
							key={`${endpoint.method} ${endpoint.path}`}
							data-id="public-docs-endpoint"
							className="flex flex-wrap items-baseline gap-2 font-mono text-xs"
						>
							<Badge tone="neutral">{endpoint.method}</Badge>
							<span className="break-all">
								{"{baseUrl}"}
								{endpoint.path}
							</span>
						</li>
					))}
				</ul>
			</div>
			<div className="grid gap-1 overflow-x-auto">
				<h3 className="m-0 font-semibold text-sm">
					{t("projectDocs.page.fields")}
				</h3>
				<table className="w-full border-collapse text-left">
					<thead>
						<tr className="text-muted text-xs">
							<th className="py-1 pr-3 font-normal">
								{t("projectDocs.page.field")}
							</th>
							<th className="py-1 pr-3 font-normal">
								{t("projectDocs.page.type")}
							</th>
							<th className="py-1 font-normal">
								{t("projectDocs.page.detail")}
							</th>
						</tr>
					</thead>
					<tbody>
						{resource.fields.map((field) => (
							<FieldRow key={field.name} field={field} />
						))}
					</tbody>
				</table>
			</div>
			<div className="grid gap-1">
				<h3 className="m-0 font-semibold text-sm">
					{t("projectDocs.page.example")}
				</h3>
				<pre className="m-0 overflow-x-auto rounded-sm bg-fg/6 p-2 font-mono text-xs">
					{JSON.stringify(resource.example, null, 2)}
				</pre>
			</div>
		</section>
	);
}

function DocsView({ docs }: { docs: ProjectDocs }) {
	const t = useT();
	return (
		<main
			data-id="public-docs"
			className="mx-auto grid max-w-3xl gap-4 px-4 py-8"
		>
			<div className="grid gap-2">
				<Badge tone="primary" className="w-fit">
					{t("projectDocs.page.badge")}
				</Badge>
				<h1 className="m-0 font-bold font-mono text-2xl">{docs.name}</h1>
				<p className="m-0 text-muted text-sm">{t("projectDocs.page.intro")}</p>
			</div>
			{docs.resources.length === 0 ? (
				<p className="m-0 text-muted text-sm">{t("projectDocs.page.empty")}</p>
			) : (
				docs.resources.map((resource) => (
					<ResourceSection key={resource.name} resource={resource} />
				))
			)}
		</main>
	);
}

function PublicDocs({ slug }: { slug: string }) {
	const t = useT();
	const query = usePublicDocs(slug);
	useAppTitle(query.data?.name ?? t("projectDocs.page.pageTitle"));
	if (query.isPending) return <PageLoading />;
	if (query.error) {
		return (
			<PublicViewError
				error={query.error}
				onRetry={() => void query.refetch()}
				notFoundTitle={t("projectDocs.page.notFoundTitle")}
				notFoundText={t("projectDocs.page.notFoundText")}
			/>
		);
	}
	return <DocsView docs={query.data} />;
}

/**
 * `/p/:slug/docs`: the published docs of a mock project, read without
 * signing in. Home while `projectDocs` is off.
 */
export function PublicDocsPage() {
	const { projectDocs } = useFeatures();
	const { slug = "" } = useParams();
	if (!projectDocs) return <Navigate to="/" replace />;
	return <PublicDocs key={slug} slug={slug} />;
}
