/**
 * Related environment and mock project of a collection, as rows of the
 * details list (Overview and Info). Both open what they name: the
 * environment as a tab, the mock project's page. An Editor picks the
 * environment on the Overview (environments flag on).
 */
import type { CollectionDetail } from "@localman/shared/api-client";
import { IconDatabase } from "@tabler/icons-react";
import { Link } from "react-router";
import { Select } from "../../components/ui/select";
import { useT } from "../../i18n/i18n-context";
import { ColorDot } from "../environments/environment-color";
import { useEnvironmentList } from "../environments/use-environments";
import { useEnvironmentsEnabled } from "../environments/use-environments-enabled";
import { useOpenVariablesPage } from "../environments/use-open-variables-page";
import { SyncBadge } from "../live-mock-sync/sync-badge";
import { useLiveMockSyncEnabled } from "../live-mock-sync/use-live-mock-sync";
import { useLinkEnvironment } from "./use-link-environment";

const LINK =
	"inline-flex min-w-0 max-w-full items-center gap-1.5 text-primary underline-offset-2 hover:underline";

function NotLinked() {
	const t = useT();
	return <span className="text-muted">{t("collections.links.notLinked")}</span>;
}

function EnvironmentPicker({ detail }: { detail: CollectionDetail }) {
	const t = useT();
	const list = useEnvironmentList(detail.workspaceId);
	const link = useLinkEnvironment(detail.id);
	const current = detail.relatedEnvironment?.id ?? "";
	return (
		<Select
			value={current}
			disabled={link.isPending || !list.data}
			aria-label={t("collections.links.choose")}
			data-id="collection-meta-env-select"
			className="min-h-9 text-xs"
			onChange={(event) => link.mutate(event.target.value || null)}
		>
			<option value="">{t("collections.links.none")}</option>
			{(list.data ?? []).map((env) => (
				<option key={env.id} value={env.id}>
					{env.name}
				</option>
			))}
		</Select>
	);
}

function EnvironmentRow({
	detail,
	canEdit,
}: {
	detail: CollectionDetail;
	canEdit: boolean;
}) {
	const t = useT();
	const { openEnvironment } = useOpenVariablesPage();
	const env = detail.relatedEnvironment;
	return (
		<>
			<dt className="text-muted">{t("collections.links.environment")}</dt>
			<dd className="m-0 grid min-w-0 gap-1">
				{env ? (
					<button
						type="button"
						data-id="collection-meta-env"
						className={`${LINK} cursor-pointer border-0 bg-transparent p-0 text-left`}
						onClick={() => openEnvironment(env.id, env.name)}
					>
						<ColorDot color={env.color} />
						<span className="truncate">{env.name}</span>
					</button>
				) : (
					<NotLinked />
				)}
				{env?.source === "shared" ? (
					<span className="text-muted text-xs">
						{t("collections.links.sharedHint")}
					</span>
				) : null}
				{canEdit ? <EnvironmentPicker detail={detail} /> : null}
			</dd>
		</>
	);
}

export interface CollectionLinksMetaProps {
	detail: CollectionDetail;
	/** An Editor on the collection's own Overview may change the environment. */
	canEditEnvironment: boolean;
}

/** `<dt>`/`<dd>` pairs for a `<dl>` of collection details. */
export function CollectionLinksMeta({
	detail,
	canEditEnvironment,
}: CollectionLinksMetaProps) {
	const t = useT();
	const environments = useEnvironmentsEnabled();
	const liveMockSync = useLiveMockSyncEnabled();
	const project = detail.mockProject;
	return (
		<>
			{environments ? (
				<EnvironmentRow detail={detail} canEdit={canEditEnvironment} />
			) : null}
			<dt className="text-muted">{t("collections.links.mockProject")}</dt>
			<dd className="m-0 grid min-w-0 justify-items-start gap-1">
				{project ? (
					<Link
						to={`/projects/${encodeURIComponent(project.id)}`}
						data-id="collection-meta-mock"
						className={LINK}
					>
						<IconDatabase size={14} aria-hidden="true" className="flex-none" />
						<span className="truncate">{project.name}</span>
					</Link>
				) : (
					<NotLinked />
				)}
				{liveMockSync && project ? <SyncBadge detail={detail} /> : null}
			</dd>
		</>
	);
}
