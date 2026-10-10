import { useRef } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
	DropdownMenuControlItem,
	DropdownMenuGroup,
} from "../../components/ui/dropdown-menu";
import { useT } from "../../i18n/i18n-context";
import { elementRoleLabel } from "../sharing/use-element-access";
import { useResolveAccessRequest } from "../sharing/use-resolve-access-request";
import type { AppNotification } from "./notifications-api";

export interface AccessRequestActionsProps {
	request: NonNullable<AppNotification["accessRequest"]>;
	/** Title of the notification, to name the group for screen readers. */
	title: string;
	/** Reload the list: after a decision, or when the request moved on. */
	onChanged: () => void;
}

/**
 * Approve and Deny under a pending `access.requested` notification;
 * "Approved" or "Declined" once handled. Approve grants the role this
 * notification announced (its body says it), so a request upgraded since
 * is refused (`REQUEST_CHANGED`) rather than approved unseen. The buttons
 * are menu items so arrow keys reach them; choosing one keeps the menu
 * open and moves focus to the notification before the buttons go away.
 */
export function AccessRequestActions({
	request,
	title,
	onChanged,
}: AccessRequestActionsProps) {
	const t = useT();
	const group = useRef<HTMLDivElement>(null);
	function settle() {
		const item = group.current?.previousElementSibling;
		if (item instanceof HTMLElement) item.focus();
		onChanged();
	}
	const resolve = useResolveAccessRequest({
		onResolved: settle,
		onStale: settle,
		changedMessage: t("sharing.errors.requestChangedBell"),
	});
	if (request.status !== "pending") {
		return (
			<div className="px-3 pb-2 pl-7">
				<Badge
					tone={request.status === "approved" ? "success" : "neutral"}
					data-id="notifications-access-status"
				>
					{t(`sharing.requestPage.${request.status}`)}
				</Badge>
			</div>
		);
	}
	const busy = resolve.isPending ? resolve.variables?.action : undefined;
	return (
		<DropdownMenuGroup
			ref={group}
			aria-label={title}
			className="flex flex-wrap gap-2 px-3 pb-2 pl-7"
		>
			<DropdownMenuControlItem
				onSelect={(event) => {
					event.preventDefault();
					if (resolve.isPending) return;
					resolve.mutate({
						action: "approve",
						requestId: request.id,
						role: request.notifiedRole,
					});
				}}
			>
				<Button
					variant="primary"
					size="sm"
					loading={busy === "approve"}
					data-id="notifications-approve"
				>
					{t("sharing.requestPage.approveAs", {
						role: elementRoleLabel(request.notifiedRole, t),
					})}
				</Button>
			</DropdownMenuControlItem>
			<DropdownMenuControlItem
				onSelect={(event) => {
					event.preventDefault();
					if (resolve.isPending) return;
					resolve.mutate({ action: "deny", requestId: request.id });
				}}
			>
				<Button
					variant="secondary"
					size="sm"
					loading={busy === "deny"}
					data-id="notifications-deny"
				>
					{t("sharing.requestPage.deny")}
				</Button>
			</DropdownMenuControlItem>
		</DropdownMenuGroup>
	);
}
