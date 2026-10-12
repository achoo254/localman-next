import {
	AUTH_TYPES,
	type AuthType,
	type RequestAuth,
} from "@localman/shared/api-client";
import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "../../components/ui/tabs";
import { useT } from "../../i18n/i18n-context";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { AuthForm } from "../api-client/request/auth-form";
import { ScriptsEditor } from "../api-client/scripts/scripts-tab";
import type { CollectionPageTab } from "../api-client/workbench/workbench-tab-types";
import { CollectionActivity } from "./collection-activity";
import { collectionErrorMessage } from "./collection-errors";
import { CollectionShareDialog } from "./collection-share-dialog";
import { CollectionTags } from "./collection-tags";
import { PageHeader } from "./page-header";
import { PageOverview } from "./page-overview";
import { PageVariables } from "./page-variables";
import { StatusMenu } from "./status-menu";
import { type PageFields, usePageModel } from "./use-page-model";

const SECTIONS = ["overview", "authorization", "scripts", "variables"] as const;
/** A collection never inherits: it is the top. */
const COLLECTION_AUTH: readonly AuthType[] = AUTH_TYPES.filter(
	(type) => type !== "inherit",
);

/** Tab of a collection or folder: Overview, Authorization, Scripts (Variables). */
export function CollectionPage({ page }: { page: CollectionPageTab }) {
	const t = useT();
	const model = usePageModel(page);
	const [sharing, setSharing] = useState(false);
	const skeleton = useDelayedFlag(model.query.isPending);
	const { detail, fields } = model;
	if (skeleton) {
		return (
			<SkeletonRegion className="grid gap-4 p-4">
				<Skeleton className="h-9 w-64 max-w-full" />
				<Skeleton variant="text" lines={4} />
			</SkeletonRegion>
		);
	}
	if (model.query.isError) {
		return (
			<div className="grid justify-items-start gap-3 p-4">
				<Alert tone="danger" title={t("collections.page.loadFailed")}>
					{collectionErrorMessage(model.query.error, t)}
				</Alert>
				<Button size="sm" onClick={() => void model.query.refetch()}>
					{t("common.cta.retry")}
				</Button>
			</div>
		);
	}
	if (model.missing) {
		return (
			<p className="m-0 p-4 text-muted text-sm">
				{t("collections.page.folderGone")}
			</p>
		);
	}
	if (!detail || !fields) return null;
	const sections = page.kind === "collection" ? SECTIONS : SECTIONS.slice(0, 3);
	const readOnly = !model.canEdit;
	const setAuth = (auth: RequestAuth) => model.edit({ auth });
	const saveNow = (patch: Partial<PageFields>) => {
		model.edit(patch);
		void model.flush();
	};
	const isCollection = page.kind === "collection";

	return (
		<div data-id={`${page.kind}-page`} className="flex min-w-0 flex-col">
			<PageHeader
				page={page}
				workspaceId={detail.workspaceId}
				name={fields.name}
				collectionName={detail.name}
				canEdit={model.canEdit}
				status={model.status}
				onRename={(name) => model.edit({ name })}
				onRetry={() => void model.flush()}
				onShare={() => setSharing(true)}
				extra={
					isCollection ? (
						<StatusMenu
							status={fields.status}
							canEdit={model.canEdit}
							onChange={(status) => saveNow({ status })}
						/>
					) : null
				}
			/>
			<div className="grid gap-3 p-4">
				{readOnly ? (
					<Alert tone="info">{t("collections.page.readOnly")}</Alert>
				) : null}
				<Tabs defaultValue="overview">
					<TabsList aria-label={t("collections.page.tabs.label")}>
						{sections.map((id) => (
							<TabsTrigger key={id} value={id} data-id={`collection-tab-${id}`}>
								{t(`collections.page.tabs.${id}`)}
							</TabsTrigger>
						))}
					</TabsList>
					<TabsContent value="overview" className="pt-4">
						<PageOverview
							detail={detail}
							folderId={page.nodeId}
							aside={
								isCollection ? (
									<>
										<CollectionTags
											tags={fields.tags}
											canEdit={model.canEdit}
											onChange={(tags) => saveNow({ tags })}
										/>
										<CollectionActivity collectionId={detail.id} />
									</>
								) : null
							}
							description={fields.description}
							canEdit={model.canEdit}
							onSave={(description) => {
								model.edit({ description });
								void model.flush();
							}}
						/>
					</TabsContent>
					<TabsContent value="authorization" className="grid gap-3 pt-4">
						<p className="m-0 text-muted text-sm">
							{t("collections.page.auth.note")}
						</p>
						<AuthForm<RequestAuth>
							auth={fields.auth}
							types={page.kind === "collection" ? COLLECTION_AUTH : AUTH_TYPES}
							inheritNote={t("collections.page.auth.folderInherit")}
							disabled={readOnly}
							onChange={setAuth}
						/>
					</TabsContent>
					<TabsContent value="scripts" className="pt-4">
						<ScriptsEditor
							scripts={fields.scripts}
							readOnly={readOnly}
							note={
								<p className="m-0 text-muted text-xs">
									{t("collections.page.scripts.order")}
								</p>
							}
							onChange={(phase, text) =>
								model.edit({ scripts: { ...fields.scripts, [phase]: text } })
							}
						/>
					</TabsContent>
					{page.kind === "collection" ? (
						<TabsContent value="variables" className="pt-4">
							<PageVariables
								collectionId={page.collectionId}
								variables={fields.variables}
								canEdit={model.canEdit}
								onChange={(variables) => model.edit({ variables })}
							/>
						</TabsContent>
					) : null}
				</Tabs>
			</div>
			<CollectionShareDialog
				open={sharing}
				onOpenChange={setSharing}
				workspaceId={detail.workspaceId}
				elementId={detail.id}
				elementName={detail.name}
			/>
		</div>
	);
}
