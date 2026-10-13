import { IconLink, IconPlus } from "@tabler/icons-react";
import { useId } from "react";
import { Button } from "../../components/ui/button";
import { CopyField } from "../../components/ui/copy-field";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { useI18n } from "../../i18n/i18n-context";
import { useTenantInfo } from "../../lib/tenant-info";
import { useWorkspaceInvite } from "./use-workspace-invite";
import { ROLE_CHOICES, roleLabel } from "./workspace-labels";

export interface WorkspaceInviteFormProps {
	workspaceId: string;
	/** No free seat: every control is locked. */
	disabled: boolean;
}

/**
 * Invite by username or email with a role, or copy a one-use invite link
 * for someone without an account. The link of the last invitation shows
 * once below, copied at once when it is the only way to reach them.
 */
export function WorkspaceInviteForm({
	workspaceId,
	disabled,
}: WorkspaceInviteFormProps) {
	const { t, formatDate } = useI18n();
	const idpName = useTenantInfo().displayName;
	const roleId = useId();
	const flow = useWorkspaceInvite(workspaceId);
	const { issued } = flow;
	return (
		<>
			<fieldset
				disabled={disabled}
				data-id="ws-settings-invite-form"
				className="m-0 grid min-w-0 gap-3 border-0 p-0"
			>
				<legend className="sr-only">{t("workspaces.invite.legend")}</legend>
				<form
					noValidate
					onSubmit={(event) => {
						event.preventDefault();
						flow.submit();
					}}
				>
					<FormField
						label={t("workspaces.invite.label")}
						error={flow.error ?? undefined}
						announceError
					>
						<div className="flex flex-wrap gap-2">
							<Input
								value={flow.value}
								placeholder={t("workspaces.invite.placeholder")}
								autoComplete="off"
								data-id="ws-settings-invite-email"
								readOnly={flow.inviting}
								className="min-w-0 flex-1 basis-56"
								onChange={(event) => flow.change(event.target.value)}
							/>
							<Select
								id={roleId}
								invalid={false}
								aria-label={t("workspaces.invite.role")}
								value={flow.role}
								data-id="ws-settings-invite-role"
								className="w-auto"
								onChange={(event) => {
									const next = ROLE_CHOICES.find(
										(role) => role === event.target.value,
									);
									if (next) flow.setRole(next);
								}}
							>
								{ROLE_CHOICES.map((role) => (
									<option key={role} value={role}>
										{roleLabel(role, t)}
									</option>
								))}
							</Select>
							<Button
								type="submit"
								variant="primary"
								data-id="ws-settings-invite"
								loading={flow.inviting}
								className="min-h-11"
								leadingIcon={<IconPlus size={16} aria-hidden="true" />}
							>
								{t("workspaces.invite.submit")}
							</Button>
						</div>
					</FormField>
				</form>
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<Button
						size="sm"
						data-id="ws-settings-invite-link"
						loading={flow.linking}
						leadingIcon={<IconLink size={14} aria-hidden="true" />}
						onClick={flow.createLink}
					>
						{t("workspaces.invite.link")}
					</Button>
					<span className="text-muted text-[0.8125rem]">
						{t("workspaces.invite.linkHelp", { idpName })}
					</span>
				</div>
			</fieldset>
			{issued ? (
				<CopyField
					key={issued.url}
					label={issued.label}
					value={issued.url}
					hint={
						issued.expiresAt
							? t("workspaces.invite.linkHint", {
									date: formatDate(issued.expiresAt),
								})
							: t("workspaces.invite.linkHintNoDate")
					}
					autoCopy={issued.autoCopy}
					data-id="ws-settings-invite-url"
					copyDataId="ws-settings-invite-url-copy"
				/>
			) : null}
		</>
	);
}
