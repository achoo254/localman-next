import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import type { Project } from "../../pages/projects/projects-api";
import { MaskedHeaders } from "./masked-headers";
import { ReadonlyNote } from "./readonly-note";
import { UpstreamForm } from "./upstream-form";
import { useTrafficSettings } from "./use-traffic-settings";

export interface UpstreamSettingsProps {
	project: Project;
}

/**
 * Panel "Upstream" of the endpoint card: where the hybrid mock forwards
 * the routes it does not answer, and which headers the request log masks.
 * Collaborators see the same panel read only.
 */
export function UpstreamSettings({ project }: UpstreamSettingsProps) {
	const t = useT();
	const query = useTrafficSettings(project.id);
	return (
		<div className="grid gap-6 p-6">
			<div className="grid gap-2">
				<h2 className="m-0 font-mono font-semibold text-[0.8125rem] text-muted">
					{t("upstream.title")}
				</h2>
				<p className="m-0 text-muted text-sm wrap-anywhere">
					{renderRich(t("upstream.intro", { baseUrl: project.mockBaseUrl }))}
				</p>
			</div>
			{query.isPending ? (
				<p className="m-0 text-muted text-sm">{t("upstream.loading")}</p>
			) : query.isError ? (
				<Alert tone="danger" data-id="project-detail-upstream-error">
					<p className="m-0">{t("upstream.loadFailed")}</p>
					<Button
						size="sm"
						className="mt-2"
						onClick={() => void query.refetch()}
					>
						{t("common.cta.retry")}
					</Button>
				</Alert>
			) : (
				<>
					{query.data.canManage ? null : (
						<ReadonlyNote data-id="project-detail-upstream-readonly">
							{t("upstream.readonly")}
						</ReadonlyNote>
					)}
					<UpstreamForm projectId={project.id} settings={query.data} />
					<p className="m-0 text-muted text-sm">{t("upstream.quotaNote")}</p>
					<MaskedHeaders projectId={project.id} settings={query.data} />
				</>
			)}
		</div>
	);
}
