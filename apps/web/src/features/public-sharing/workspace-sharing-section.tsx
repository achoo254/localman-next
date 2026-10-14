import { workspaceRoleAllows } from "@localman/shared/access";
import {
	WORKSPACE_SHARING_SWITCHES,
	type WorkspaceSharingSettings,
	type WorkspaceSharingSwitch,
} from "@localman/shared/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useId, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { Switch } from "../../components/ui/switch";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import type { Workspace } from "../workspaces/workspaces-api";
import { publicSharingErrorMessage } from "./public-sharing-errors";
import { useWorkspaceSharing, workspaceSharingKey } from "./use-public-sharing";
import { updateWorkspaceSharing } from "./workspace-sharing-api";
import { WorkspaceSharingOffModal } from "./workspace-sharing-off-modal";

function SwitchRow({
	name,
	checked,
	disabled,
	onChange,
}: {
	name: WorkspaceSharingSwitch;
	checked: boolean;
	disabled: boolean;
	onChange: (on: boolean) => void;
}) {
	const t = useT();
	const labelId = useId();
	const hintId = useId();
	return (
		<li className="flex items-start justify-between gap-4 border-border-subtle border-b py-3 last:border-b-0">
			<div className="grid min-w-0 gap-0.5">
				<b id={labelId} className="text-sm">
					{t(`publicSharing.view.workspace.switches.${name}`)}
				</b>
				<span id={hintId} className="text-muted text-[0.8125rem]">
					{t(`publicSharing.view.workspace.hints.${name}`)}
				</span>
			</div>
			<Switch
				checked={checked}
				disabled={disabled}
				aria-labelledby={labelId}
				aria-describedby={hintId}
				data-id={`ws-sharing-${name}`}
				onCheckedChange={onChange}
			/>
		</li>
	);
}

/**
 * "Public sharing" of workspace settings: three switches. Admins change
 * them (turning one off confirms with what stops), others read them.
 */
export function WorkspaceSharingSection({
	workspace,
}: {
	workspace: Workspace;
}) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const titleId = useId();
	const query = useWorkspaceSharing(workspace.id);
	const canEdit = workspaceRoleAllows(workspace.role, "manageVisibility");
	const [turningOff, setTurningOff] = useState<WorkspaceSharingSwitch | null>(
		null,
	);
	const turnOn = useMutation({
		mutationFn: (name: WorkspaceSharingSwitch) =>
			updateWorkspaceSharing(workspace.id, { [name]: true }, false),
		onSuccess: (result) => {
			client.setQueryData<WorkspaceSharingSettings>(
				workspaceSharingKey(workspace.id),
				result.sharing,
			);
			toast.show({
				tone: "success",
				title: t("publicSharing.view.workspace.saved"),
			});
		},
		onError: (error) =>
			toast.show({ tone: "error", title: publicSharingErrorMessage(error, t) }),
	});

	let body: ReactNode;
	if (query.isPending) {
		body = (
			<SkeletonRegion className="grid gap-2">
				<Skeleton className="h-12 w-full" />
				<Skeleton className="h-12 w-full" />
				<Skeleton className="h-12 w-full" />
			</SkeletonRegion>
		);
	} else if (query.error) {
		body = (
			<Alert tone="danger" title={t("publicSharing.view.workspace.loadFailed")}>
				{publicSharingErrorMessage(query.error, t)}
			</Alert>
		);
	} else {
		const settings = query.data;
		body = (
			<ul className="m-0 list-none p-0">
				{WORKSPACE_SHARING_SWITCHES.map((name) => (
					<SwitchRow
						key={name}
						name={name}
						checked={settings[name]}
						disabled={!canEdit || turnOn.isPending}
						onChange={(on) => {
							if (on) turnOn.mutate(name);
							else setTurningOff(name);
						}}
					/>
				))}
			</ul>
		);
	}

	return (
		<section
			aria-labelledby={titleId}
			className="grid gap-3"
			data-id="ws-settings-sharing"
		>
			<div className="grid gap-1">
				<h2 id={titleId} className="m-0 font-bold font-mono text-lg">
					{t("publicSharing.view.workspace.title")}
				</h2>
				<p className="m-0 text-muted text-sm">
					{t("publicSharing.view.workspace.text")}
				</p>
			</div>
			{!canEdit ? (
				<Alert tone="info" data-id="ws-sharing-read-only">
					{t("publicSharing.view.workspace.readOnly")}
				</Alert>
			) : null}
			{body}
			<WorkspaceSharingOffModal
				workspaceId={workspace.id}
				name={turningOff}
				onClose={() => setTurningOff(null)}
			/>
		</section>
	);
}
