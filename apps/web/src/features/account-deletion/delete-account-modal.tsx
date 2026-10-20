import { useEffect, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { ExternalLink } from "../../components/ui/external-link";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { errorMessage } from "../../lib/api-client";
import { ACCOUNT_DELETED_QUERY, LEGAL_PATHS } from "../../lib/legal";
import { idpAccountDeleteUrlOf, useTenantInfo } from "../../lib/tenant-info";
import { reloadAt } from "../../platform/navigation";
import { forgetSilentSignIn } from "../auth/silent-sign-in";
import { forgetSavedPages } from "../collections/page-storage";
import { releasePushSubscriptionForLogout } from "../notifications/release-push-on-logout";
import {
	type AccountDeletionSummary,
	deleteAccount,
	previewAccountDeletion,
} from "./account-deletion-api";
import { DeletionSummary } from "./deletion-summary";

type Preview =
	| { status: "loading" }
	| { status: "ready"; summary: AccountDeletionSummary }
	| { status: "error"; error: unknown };

export interface DeleteAccountModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The username the person types back to confirm. */
	username: string;
}

/**
 * After the account is gone: this browser forgets it (Web Push, saved
 * pages, the silent sign-in hint, which would otherwise sign the person
 * straight back in as a new account) and loads the public page that
 * confirms the deletion.
 */
async function leaveDeletedAccount(): Promise<void> {
	await releasePushSubscriptionForLogout();
	forgetSavedPages();
	forgetSilentSignIn();
	reloadAt(`${LEGAL_PATHS.accountDelete}?${ACCOUNT_DELETED_QUERY}=1`);
}

/**
 * "Delete account": runs the dry run when it opens, lists what goes and
 * what blocks it, and deletes once the username is typed back.
 */
export function DeleteAccountModal({
	open,
	onOpenChange,
	username,
}: DeleteAccountModalProps) {
	const t = useT();
	const tenant = useTenantInfo();
	const [preview, setPreview] = useState<Preview>({ status: "loading" });
	const [typed, setTyped] = useState("");

	useEffect(() => {
		if (!open) return;
		let current = true;
		setTyped("");
		setPreview({ status: "loading" });
		previewAccountDeletion().then(
			(summary) => current && setPreview({ status: "ready", summary }),
			(error: unknown) => current && setPreview({ status: "error", error }),
		);
		return () => {
			current = false;
		};
	}, [open]);

	const blocked =
		preview.status === "ready" && preview.summary.blockedWorkspaces.length > 0;
	const ready = preview.status === "ready" && !blocked;
	return (
		<ConfirmModal
			open={open}
			onOpenChange={onOpenChange}
			title={t("account.delete.title")}
			question={t("account.delete.question")}
			confirmLabel={t("account.delete.confirm")}
			confirmDisabled={!ready || typed.trim() !== username}
			onConfirm={async () => {
				await deleteAccount(typed);
				await leaveDeletedAccount();
			}}
			data-id="delete-account-modal"
		>
			{preview.status === "loading" ? (
				<SkeletonRegion label={t("account.delete.loading")}>
					<Skeleton variant="text" lines={3} className="w-full" />
				</SkeletonRegion>
			) : null}
			{preview.status === "error" ? (
				<Alert tone="danger" title={t("account.delete.loadFailed")}>
					{errorMessage(preview.error)}
				</Alert>
			) : null}
			{preview.status === "ready" ? (
				<DeletionSummary summary={preview.summary} />
			) : null}
			<p className="m-0 text-sm">
				{renderRich(t("account.delete.idp", { idpName: tenant.displayName }), {
					idpDelete: (chunk) => (
						<ExternalLink
							href={idpAccountDeleteUrlOf(tenant)}
							className="font-semibold text-primary underline underline-offset-4"
						>
							{chunk}
						</ExternalLink>
					),
				})}
			</p>
			{ready ? (
				<FormField
					label={renderRich(t("account.delete.confirmLabel", { username }))}
					data-id="delete-account-confirm-field"
				>
					<Input
						value={typed}
						onChange={(event) => setTyped(event.target.value)}
						autoComplete="off"
						spellCheck={false}
						data-id="delete-account-confirm-input"
					/>
				</FormField>
			) : null}
		</ConfirmModal>
	);
}
