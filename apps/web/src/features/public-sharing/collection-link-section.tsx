import type { CollectionLinkKind } from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { CopyField } from "../../components/ui/copy-field";
import { Skeleton } from "../../components/ui/skeleton";
import { Switch } from "../../components/ui/switch";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import {
	type CollectionLink,
	disableCollectionLink,
	enableCollectionLink,
} from "./collection-links-api";
import {
	publicSharingErrorMessage,
	withTranslatedError,
} from "./public-sharing-errors";
import { PublishConfirm } from "./publish-confirm";
import { collectionLinkKey, useCollectionLink } from "./use-public-sharing";
import { usePublishFlow } from "./use-publish-flow";

/**
 * One link of a collection (public or guest) with its switch. On: dry
 * run, confirm with the secret warning, then publish and show the link.
 * Off: confirm, then the link stops working.
 */
export function CollectionLinkSection({
	collectionId,
	kind,
}: {
	collectionId: string;
	kind: CollectionLinkKind;
}) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const titleId = useId();
	const key = collectionLinkKey(collectionId, kind);
	const query = useCollectionLink(collectionId, kind);
	const [turningOff, setTurningOff] = useState(false);
	const flow = usePublishFlow(
		(_: undefined, dryRun: boolean) =>
			enableCollectionLink(collectionId, kind, dryRun),
		(result) => {
			client.setQueryData<CollectionLink | null>(key, result.link);
			toast.show({
				tone: "success",
				title: t(`publicSharing.share.links.${kind}.turnedOn`),
			});
		},
	);
	const link = query.data ?? null;
	const dataId = `share-${kind}-link`;

	async function turnOff() {
		await withTranslatedError(t, () =>
			disableCollectionLink(collectionId, kind),
		);
		client.setQueryData<CollectionLink | null>(key, null);
		toast.show({ title: t(`publicSharing.share.links.${kind}.turnedOff`) });
	}

	return (
		<section aria-labelledby={titleId} className="grid gap-3" data-id={dataId}>
			<div className="flex items-start justify-between gap-4">
				<div className="grid min-w-0 gap-1">
					<h3 id={titleId} className="m-0 font-mono font-semibold text-sm">
						{t(`publicSharing.share.links.${kind}.title`)}
					</h3>
					<p className="m-0 text-muted text-[0.8125rem]">
						{t(`publicSharing.share.links.${kind}.text`)}
					</p>
				</div>
				{query.isPending ? (
					<Skeleton className="h-5 w-9 rounded-full" />
				) : (
					<Switch
						checked={link !== null}
						aria-labelledby={titleId}
						aria-busy={flow.checking || undefined}
						disabled={query.isError || flow.pending !== null}
						data-id={`${dataId}-switch`}
						onCheckedChange={(on) => {
							if (on) flow.start(undefined);
							else setTurningOff(true);
						}}
					/>
				)}
			</div>
			{query.error ? (
				<Alert tone="danger" title={t("publicSharing.share.links.loadFailed")}>
					{publicSharingErrorMessage(query.error, t)}
				</Alert>
			) : null}
			{flow.checkError ? (
				<Alert tone="danger" data-id={`${dataId}-error`}>
					{publicSharingErrorMessage(flow.checkError, t)}
				</Alert>
			) : null}
			{flow.pending ? (
				<PublishConfirm
					title={t(`publicSharing.share.links.${kind}.confirmTitle`)}
					warnings={flow.pending.warnings}
					confirmLabel={t(`publicSharing.share.links.${kind}.confirm`)}
					busy={flow.publishing}
					error={flow.publishError}
					onConfirm={flow.confirm}
					onCancel={flow.cancel}
					data-id={`${dataId}-confirm`}
				/>
			) : null}
			{link ? (
				<CopyField
					label={t(`publicSharing.share.links.${kind}.copyLabel`)}
					value={link.url}
					data-id={`${dataId}-url`}
					copyDataId={`${dataId}-copy`}
				/>
			) : null}
			<ConfirmModal
				open={turningOff}
				onOpenChange={setTurningOff}
				title={t(`publicSharing.share.links.${kind}.offTitle`)}
				question={t(`publicSharing.share.links.${kind}.offQuestion`)}
				confirmLabel={t("publicSharing.share.links.turnOff")}
				onConfirm={turnOff}
				data-id={`${dataId}-off`}
			>
				<span>{t(`publicSharing.share.links.${kind}.offText`)}</span>
			</ConfirmModal>
		</section>
	);
}
