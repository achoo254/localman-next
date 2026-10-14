import {
	WORKSPACE_PERMISSIONS,
	WORKSPACE_ROLES,
	type WorkspaceAction,
	workspaceRoleAllows,
} from "@localman/shared/access";
import { IconCheck, IconMinus } from "@tabler/icons-react";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import { roleLabel } from "./workspace-labels";

/** Every row of the shared permission table, in its order. */
const ACTIONS = Object.keys(WORKSPACE_PERMISSIONS).filter(
	(key): key is WorkspaceAction => Object.hasOwn(WORKSPACE_PERMISSIONS, key),
);

const CELL = "border-border-subtle border-b px-3 py-2";

/**
 * "Permissions by role", read from `WORKSPACE_PERMISSIONS`: the same table
 * the API decides with, so what is shown is what is enforced.
 */
export function WorkspacePermissionsTable() {
	const t = useT();
	const { publicSharing } = useFeatures();
	// Unreleased features are not advertised.
	const actions = publicSharing
		? ACTIONS
		: ACTIONS.filter((action) => action !== "publishPublic");
	return (
		<details data-id="ws-settings-permissions" className="text-sm">
			<summary className="min-h-11 cursor-pointer content-center font-mono font-semibold text-[0.8125rem]">
				{t("workspaces.permissions.summary")}
			</summary>
			<div className="overflow-x-auto">
				<table className="w-full border-collapse text-left">
					<thead>
						<tr>
							<th scope="col" className={CELL}>
								{t("workspaces.permissions.action")}
							</th>
							{WORKSPACE_ROLES.map((role) => (
								<th key={role} scope="col" className={`${CELL} text-center`}>
									{roleLabel(role, t)}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{actions.map((action) => (
							<tr key={action}>
								<th scope="row" className={`${CELL} font-normal`}>
									{t(`workspaces.permissions.actions.${action}`)}
								</th>
								{WORKSPACE_ROLES.map((role) => (
									<td key={role} className={`${CELL} text-center`}>
										{workspaceRoleAllows(role, action) ? (
											<IconCheck
												size={16}
												role="img"
												className="inline text-success"
												aria-label={t("workspaces.permissions.allowed")}
											/>
										) : (
											<IconMinus
												size={16}
												role="img"
												className="inline text-icon-muted"
												aria-label={t("workspaces.permissions.notAllowed")}
											/>
										)}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</details>
	);
}
