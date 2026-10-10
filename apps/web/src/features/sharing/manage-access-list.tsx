import type {
	ElementRole,
	ShareableElementType,
} from "@localman/shared/access";
import { IconUsers, IconX } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId } from "react";
import { Badge } from "../../components/ui/badge";
import { IconButton } from "../../components/ui/icon-button";
import { Select } from "../../components/ui/select";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { PersonAvatar } from "../collaborators/person-avatar";
import {
	type ElementAccess,
	type ElementShare,
	removeShare,
	updateShareRole,
} from "./sharing-api";
import { sharingErrorMessage } from "./sharing-errors";
import {
	ELEMENT_ROLE_CHOICES,
	elementAccessKey,
	elementRoleLabel,
	shareName,
} from "./use-element-access";

const ROW =
	"flex flex-wrap items-center gap-x-3 gap-y-2 border-border-subtle border-b py-3 last:border-b-0";

export interface ManageAccessListProps {
	elementType: ShareableElementType;
	elementId: string;
	access: ElementAccess;
	/** The caller has `manageRoles`; otherwise the list is read-only. */
	canManage: boolean;
}

/**
 * "Manage access": everyone in the workspace (by workspace role), then one
 * row per share with a role select and a remove button for managers.
 */
export function ManageAccessList({
	elementType,
	elementId,
	access,
	canManage,
}: ManageAccessListProps) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const key = elementAccessKey(elementType, elementId);
	const titleId = useId();
	const fail = (error: unknown) => {
		toast.show({ tone: "error", title: sharingErrorMessage(error, t) });
		void client.invalidateQueries({ queryKey: key });
	};

	const changeRole = useMutation({
		mutationFn: (input: { share: ElementShare; role: ElementRole }) =>
			updateShareRole(elementType, elementId, input.share.id, input.role),
		onSuccess: (next, input) => {
			client.setQueryData(key, next);
			toast.show({
				tone: "success",
				title: t("sharing.access.roleChanged", {
					name: shareName(input.share, t),
					role: elementRoleLabel(input.role, t),
				}),
			});
		},
		onError: fail,
	});

	const remove = useMutation({
		mutationFn: (share: ElementShare) =>
			removeShare(elementType, elementId, share.id),
		onSuccess: (_result, share) => {
			client.setQueryData<ElementAccess>(key, (current) =>
				current
					? {
							...current,
							shares: current.shares.filter((s) => s.id !== share.id),
						}
					: current,
			);
			toast.show({
				title: t("sharing.access.removed", { name: shareName(share, t) }),
			});
		},
		onError: fail,
	});

	const pending = changeRole.isPending ? changeRole.variables : undefined;
	return (
		<section aria-labelledby={titleId} className="grid gap-1">
			<h3
				id={titleId}
				className="m-0 font-mono font-semibold text-[0.8125rem] text-muted"
			>
				{t("sharing.access.title")}
			</h3>
			<ul data-id="share-access-list" className="m-0 list-none p-0">
				<li data-id="share-access-workspace" className={ROW}>
					<span
						aria-hidden="true"
						className="grid size-8 shrink-0 place-items-center rounded-sm bg-viz-grey text-on-tone"
					>
						<IconUsers size={16} />
					</span>
					<div className="grid min-w-0 flex-1 basis-40">
						<b className="truncate text-sm">
							{access.workspace
								? t("sharing.access.everyone", {
										workspace: access.workspace.name,
									})
								: t("sharing.access.workspaceGone")}
						</b>
						<span className="text-muted text-[0.8125rem]">
							{t("sharing.access.byWorkspaceRole")}
						</span>
					</div>
					<Badge tone="neutral">{t("sharing.access.workspaceBadge")}</Badge>
				</li>
				{access.shares.map((share) => {
					const name = shareName(share, t);
					const accountless = share.userId === null;
					return (
						<li key={share.id} data-id="share-access-item" className={ROW}>
							<PersonAvatar name={name} picture={share.picture} />
							<div className="grid min-w-0 flex-1 basis-40">
								<b className="truncate text-sm">{name}</b>
								<span className="truncate text-muted text-[0.8125rem]">
									{accountless
										? t("sharing.access.emailOnly")
										: share.username
											? `@${share.username}`
											: ""}
								</span>
							</div>
							<Select
								aria-label={t("sharing.access.roleOf", { name })}
								value={
									pending?.share.id === share.id ? pending.role : share.role
								}
								disabled={!canManage}
								data-id="share-access-role"
								className="w-auto"
								onChange={(event) => {
									const role = ELEMENT_ROLE_CHOICES.find(
										(r) => r === event.target.value,
									);
									if (role && role !== share.role) {
										changeRole.mutate({ share, role });
									}
								}}
							>
								{ELEMENT_ROLE_CHOICES.map((choice) => (
									<option key={choice} value={choice}>
										{elementRoleLabel(choice, t)}
									</option>
								))}
							</Select>
							{canManage ? (
								<IconButton
									label={t("sharing.access.remove", { name })}
									data-id="share-access-remove"
									icon={<IconX size={16} aria-hidden="true" />}
									loading={
										remove.isPending && remove.variables?.id === share.id
									}
									onClick={() => remove.mutate(share)}
								/>
							) : null}
						</li>
					);
				})}
			</ul>
		</section>
	);
}
