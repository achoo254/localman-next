import { IconArrowLeft } from "@tabler/icons-react";
import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { PageLoading } from "../../components/layout/page-loading";
import { Alert } from "../../components/ui/alert";
import { Button, buttonClassName } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "../../components/ui/tabs";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { useAppTitle } from "../../lib/use-document-title";
import { WorkspaceSharingSection } from "../public-sharing/workspace-sharing-section";
import { CreateWorkspaceModal } from "./create-workspace-modal";
import { useCurrentWorkspace } from "./current-workspace";
import { useWorkspacesEnabled } from "./use-workspaces-enabled";
import { workspaceErrorMessage } from "./workspace-errors";
import { WorkspaceGeneralPane } from "./workspace-general-pane";
import { WorkspaceIcon } from "./workspace-icon";
import { WorkspaceMembersPane } from "./workspace-members-pane";

type Section = "general" | "members";

// Below 768px the section nav is a row of tabs; from there a column.
const LIST_CLASS =
	"px-0 pt-0 md:flex-col md:self-start md:overflow-visible md:border-b-0 md:border-l";
const TRIGGER_CLASS =
	"md:-ml-px md:mb-0 md:justify-start md:border-b-0 md:border-l-2 md:px-4";

function WorkspaceSettings() {
	const t = useT();
	useAppTitle(t("workspaces.settings.title"));
	const { query, current } = useCurrentWorkspace();
	const [params, setParams] = useSearchParams();
	const [creating, setCreating] = useState(false);
	const { publicSharing } = useFeatures();
	const section: Section =
		params.get("tab") === "members" ? "members" : "general";

	if (query.isPending) return <PageLoading />;
	return (
		<div data-id="ws-settings-page" className="grid gap-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="grid min-w-0 gap-1">
					<h1 className="m-0 font-bold font-mono text-2xl">
						{t("workspaces.settings.title")}
					</h1>
					{current ? (
						<p className="m-0 flex min-w-0 items-center gap-2 text-muted text-sm">
							<WorkspaceIcon type={current.type} size={14} />
							<span className="truncate">{current.name}</span>
						</p>
					) : null}
				</div>
				<Link
					to="/api-client"
					data-id="ws-settings-back"
					className={cn(buttonClassName(), "no-underline")}
				>
					<IconArrowLeft size={16} aria-hidden="true" />
					{t("workspaces.settings.back")}
				</Link>
			</header>
			{current ? (
				<Tabs
					value={section}
					onValueChange={(value) =>
						setParams(value === "members" ? { tab: "members" } : {}, {
							replace: true,
						})
					}
					className="grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)]"
				>
					<TabsList
						aria-label={t("workspaces.settings.sections")}
						className={LIST_CLASS}
					>
						<TabsTrigger
							value="general"
							data-id="ws-settings-tab-general"
							className={TRIGGER_CLASS}
						>
							{t("workspaces.settings.general")}
						</TabsTrigger>
						<TabsTrigger
							value="members"
							data-id="ws-settings-tab-members"
							className={TRIGGER_CLASS}
						>
							{t("workspaces.settings.members")}
						</TabsTrigger>
					</TabsList>
					<Card className="p-6 max-sm:p-4">
						<TabsContent value="general">
							<WorkspaceGeneralPane key={current.id} workspace={current} />
							{publicSharing ? (
								<div className="mt-8 border-border-subtle border-t pt-6">
									<WorkspaceSharingSection
										key={current.id}
										workspace={current}
									/>
								</div>
							) : null}
						</TabsContent>
						<TabsContent value="members">
							<WorkspaceMembersPane
								key={current.id}
								workspace={current}
								onCreateTeam={() => setCreating(true)}
							/>
						</TabsContent>
					</Card>
				</Tabs>
			) : (
				<div className="grid gap-3">
					<Alert tone="danger" title={t("workspaces.settings.loadFailed")}>
						{workspaceErrorMessage(query.error, t)}
					</Alert>
					<Button
						className="justify-self-start"
						onClick={() => void query.refetch()}
					>
						{t("common.cta.retry")}
					</Button>
				</div>
			)}
			<CreateWorkspaceModal open={creating} onOpenChange={setCreating} />
		</div>
	);
}

/** `/workspace/settings`: the current workspace, while `workspaces` is on. */
export function WorkspaceSettingsPage() {
	const workspaces = useWorkspacesEnabled();
	return workspaces ? (
		<WorkspaceSettings />
	) : (
		<Navigate to="/api-client" replace />
	);
}
