import { IconKey, IconTrash } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useId, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { IconButton } from "../../components/ui/icon-button";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/toast";
import { useI18n, useT } from "../../i18n/i18n-context";
import { DANGER_GHOST } from "../collaborators/collaborators-footer";
import { type AccessKey, revokeAccessKey } from "./access-keys-api";
import {
	publicSharingErrorMessage,
	withTranslatedError,
} from "./public-sharing-errors";
import { accessKeysKey, useAccessKeys } from "./use-public-sharing";

const ROW =
	"flex items-center gap-3 border-border-subtle border-b py-3 last:border-b-0";

/** The caller's keys of the collection: name, last 4, use, expiry, revoke. */
export function AccessKeyList({ collectionId }: { collectionId: string }) {
	const t = useT();
	const { formatDate } = useI18n();
	const toast = useToast();
	const client = useQueryClient();
	const titleId = useId();
	const query = useAccessKeys(collectionId);
	const [revoking, setRevoking] = useState<AccessKey | null>(null);

	async function revoke(key: AccessKey) {
		await withTranslatedError(t, () => revokeAccessKey(collectionId, key.id));
		client.setQueryData<AccessKey[]>(accessKeysKey(collectionId), (keys) =>
			keys?.filter((k) => k.id !== key.id),
		);
		toast.show({
			title: t("publicSharing.share.keys.revoked", { name: key.name }),
		});
	}

	let body: ReactNode;
	if (query.isPending) {
		body = (
			<SkeletonRegion className="grid gap-2">
				<Skeleton className="h-12 w-full" />
			</SkeletonRegion>
		);
	} else if (query.error) {
		body = (
			<Alert tone="danger" title={t("publicSharing.share.keys.loadFailed")}>
				{publicSharingErrorMessage(query.error, t)}
			</Alert>
		);
	} else if (query.data.length === 0) {
		body = (
			<p className="m-0 text-muted text-sm" data-id="share-keys-empty">
				{t("publicSharing.share.keys.empty")}
			</p>
		);
	} else {
		body = (
			<ul className="m-0 list-none p-0" data-id="share-keys-list">
				{query.data.map((key) => (
					<li key={key.id} className={ROW} data-id="share-key-item">
						<IconKey
							size={16}
							aria-hidden="true"
							className="flex-none text-icon-muted"
						/>
						<div className="grid min-w-0 flex-1">
							<b className="truncate text-sm">
								{key.name}{" "}
								<span className="font-mono font-normal text-muted">
									{`…${key.last4}`}
								</span>
							</b>
							<span className="text-muted text-[0.8125rem]">
								{key.lastUsedAt
									? t("publicSharing.share.keys.lastUsed", {
											date: formatDate(key.lastUsedAt),
										})
									: t("publicSharing.share.keys.neverUsed")}
							</span>
							<span className="text-muted text-[0.8125rem]">
								{t("publicSharing.share.keys.expires", {
									date: formatDate(key.expiresAt),
								})}
							</span>
						</div>
						<IconButton
							label={t("publicSharing.share.keys.revoke", { name: key.name })}
							icon={<IconTrash size={16} aria-hidden="true" />}
							className={DANGER_GHOST}
							data-id="share-key-revoke"
							onClick={() => setRevoking(key)}
						/>
					</li>
				))}
			</ul>
		);
	}

	return (
		<section aria-labelledby={titleId} className="grid gap-1">
			<h4
				id={titleId}
				className="m-0 font-mono font-semibold text-[0.8125rem] text-muted"
			>
				{t("publicSharing.share.keys.listTitle")}
			</h4>
			{body}
			<ConfirmModal
				open={revoking !== null}
				onOpenChange={(open) => {
					if (!open) setRevoking(null);
				}}
				title={t("publicSharing.share.keys.revokeTitle")}
				question={t("publicSharing.share.keys.revokeQuestion", {
					name: revoking?.name ?? "",
				})}
				confirmLabel={t("publicSharing.share.keys.revokeConfirm")}
				onConfirm={async () => {
					if (revoking) await revoke(revoking);
				}}
				data-id="share-key-revoke-modal"
			>
				<span>{t("publicSharing.share.keys.revokeText")}</span>
			</ConfirmModal>
		</section>
	);
}
