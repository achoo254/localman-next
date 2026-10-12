import type { GlobalsDetail } from "@localman/shared/api-client";
import { IconDots, IconLock, IconWorld } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { IconButton } from "../../components/ui/icon-button";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import type { VariablesPageTab } from "../api-client/workbench/workbench-tab-types";
import { PageSaveState } from "../collections/page-save-state";
import { setGlobals, setGlobalsLocalValues } from "./environments-api";
import { globalsKey, storeLocalValues, useGlobals } from "./use-environments";
import { useVariableBulk } from "./use-variable-bulk";
import { useVariableEditor } from "./use-variable-editor";
import { VariableTable } from "./variable-table";

function GlobalsEditor({ globals }: { globals: GlobalsDetail }) {
	const t = useT();
	const client = useQueryClient();
	const { workspaceId } = globals;
	const canEdit = globals.role === "editor";
	const editor = useVariableEditor({
		variables: globals.variables,
		localValues: globals.localValues,
		canEdit,
		saveShared: async (writes) => {
			client.setQueryData(
				globalsKey(workspaceId),
				await setGlobals(workspaceId, writes),
			);
		},
		saveLocal: async (values) =>
			storeLocalValues(
				client,
				globalsKey(workspaceId),
				await setGlobalsLocalValues(workspaceId, values),
			),
	});
	const bulk = useVariableBulk(editor);
	return (
		<div
			data-id="globals-editor"
			className="grid min-h-0 content-start overflow-y-auto"
		>
			<header className="flex flex-wrap items-center gap-2 border-border-subtle border-b px-4 py-3">
				<IconWorld
					size={20}
					aria-hidden="true"
					className="flex-none text-icon-muted"
				/>
				<h2 className="m-0 min-w-0 flex-1 font-bold font-mono text-base">
					{t("environments.globals.title")}
				</h2>
				{canEdit ? null : (
					<Badge data-id="globals-readonly" tone="neutral">
						<IconLock size={12} aria-hidden="true" />
						{t("environments.page.readOnly")}
					</Badge>
				)}
				<PageSaveState
					status={editor.status}
					onRetry={() => void editor.flush()}
				/>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<IconButton
							size="sm"
							data-id="globals-more"
							label={t("environments.page.more", {
								name: t("environments.globals.title"),
							})}
							icon={<IconDots size={18} aria-hidden="true" />}
						/>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">{bulk.items}</DropdownMenuContent>
				</DropdownMenu>
			</header>
			<div className="grid gap-4 px-4 py-4">
				<p className="m-0 text-muted text-sm">
					{t("environments.globals.intro")}
				</p>
				<VariableTable
					editor={editor}
					caption={t("environments.globals.caption")}
				/>
			</div>
			{bulk.dialogs}
		</div>
	);
}

/** A workspace's global variables open as a tab. */
export function GlobalsPage({ page }: { page: VariablesPageTab }) {
	const t = useT();
	const query = useGlobals(page.targetId);
	const skeleton = useDelayedFlag(query.isPending);
	if (skeleton) {
		return (
			<SkeletonRegion
				label={t("environments.globals.loading")}
				className="grid gap-3 p-4"
			>
				<Skeleton className="h-9 w-48" />
				<Skeleton variant="text" lines={4} />
			</SkeletonRegion>
		);
	}
	if (query.isPending) return null;
	if (!query.data) {
		return (
			<div className="grid gap-3 p-4" data-id="globals-load-error">
				<Alert tone="danger">{t("environments.globals.loadFailed")}</Alert>
				<Button
					className="justify-self-start"
					onClick={() => void query.refetch()}
				>
					{t("common.cta.retry")}
				</Button>
			</div>
		);
	}
	return <GlobalsEditor key={query.data.workspaceId} globals={query.data} />;
}
