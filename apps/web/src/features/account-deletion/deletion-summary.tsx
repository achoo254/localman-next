import { useT } from "../../i18n/i18n-context";
import type { AccountDeletionSummary } from "./account-deletion-api";

/**
 * What the dry run found: the workspaces that block the deletion, or the
 * list of what goes (counts shown only when there is something).
 */
export function DeletionSummary({
	summary,
}: {
	summary: AccountDeletionSummary;
}) {
	const t = useT();
	if (summary.blockedWorkspaces.length > 0) {
		return (
			<div data-id="delete-account-blocked" className="grid gap-2 text-sm">
				<p className="m-0">{t("account.delete.blocked")}</p>
				<ul className="m-0 grid list-disc gap-1 pl-5">
					{summary.blockedWorkspaces.map((workspace) => (
						<li key={workspace.id} className="font-semibold">
							{workspace.name}
						</li>
					))}
				</ul>
			</div>
		);
	}
	const lines = [
		summary.ownedProjects > 0
			? t("account.delete.projects", { count: summary.ownedProjects })
			: null,
		summary.sharedProjects > 0
			? t("account.delete.sharedProjects", { count: summary.sharedProjects })
			: null,
		summary.projectMembers > 0
			? t("account.delete.projectMembers", { count: summary.projectMembers })
			: null,
		summary.workspacesDeleted > 0
			? t("account.delete.workspaces", { count: summary.workspacesDeleted })
			: null,
		summary.collectionsDeleted > 0
			? t("account.delete.collections", { count: summary.collectionsDeleted })
			: null,
		summary.workspacesLeft > 0
			? t("account.delete.leftWorkspaces", { count: summary.workspacesLeft })
			: null,
		t("account.delete.everythingElse"),
	].filter((line): line is string => line !== null);
	return (
		<div data-id="delete-account-summary" className="grid gap-2 text-sm">
			<ul className="m-0 grid list-disc gap-1 pl-5">
				{lines.map((line) => (
					<li key={line}>{line}</li>
				))}
			</ul>
			<p className="m-0 font-semibold">{t("account.delete.irreversible")}</p>
		</div>
	);
}
