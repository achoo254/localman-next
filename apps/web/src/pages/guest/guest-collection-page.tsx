import type { ReactNode } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import { PageLoading } from "../../components/layout/page-loading";
import { Button, buttonClassName } from "../../components/ui/button";
import { useFeatures } from "../../config/features";
import { PublicCollectionLayout } from "../../features/public-sharing/public-collection-layout";
import { PublicViewError } from "../../features/public-sharing/public-view-error";
import { useGuestCollection } from "../../features/public-sharing/use-public-sharing";
import { RequestAccessForm } from "../../features/sharing/request-access-form";
import { elementPath } from "../../features/sharing/sharing-api";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { useAppTitle } from "../../lib/use-document-title";

/** `?role=editor` opens the request form with Editor picked. */
const REQUEST_PARAM = "role";

function GuestCollection({ linkId }: { linkId: string }) {
	const t = useT();
	const query = useGuestCollection(linkId);
	const [params, setParams] = useSearchParams();
	useAppTitle(query.data?.name ?? t("publicSharing.view.guest.pageTitle"));
	if (query.isPending) return <PageLoading />;
	if (query.error) {
		return (
			<PublicViewError
				error={query.error}
				onRetry={() => void query.refetch()}
				homePath="/api-client"
			/>
		);
	}
	const view = query.data;
	const requesting =
		view.canRequestAccess &&
		!view.alreadyHasAccess &&
		params.get(REQUEST_PARAM) === "editor";
	if (requesting) {
		return (
			<RequestAccessForm
				elementType="collection"
				elementId={view.collectionId}
			/>
		);
	}
	let actions: ReactNode = null;
	if (view.alreadyHasAccess) {
		actions = (
			<Link
				to={elementPath("collection", view.collectionId)}
				data-id="guest-open-workspace"
				className={cn(buttonClassName({ variant: "primary" }), "no-underline")}
			>
				{t("publicSharing.view.guest.openInWorkspace")}
			</Link>
		);
	} else if (view.canRequestAccess) {
		actions = (
			<Button
				variant="primary"
				data-id="guest-request-edit"
				onClick={() => setParams({ [REQUEST_PARAM]: "editor" })}
			>
				{t("publicSharing.view.guest.requestEdit")}
			</Button>
		);
	}
	return (
		<PublicCollectionLayout
			view={view}
			badge={t("publicSharing.view.guest.guestBadge")}
			actions={actions}
			note={
				view.alreadyHasAccess ? null : (
					<p className="m-0 text-muted text-sm" data-id="guest-note">
						{t("publicSharing.view.guest.note")}
					</p>
				)
			}
		/>
	);
}

/**
 * `/guest/:linkId` (signed in): the redacted collection a guest link
 * shows. Opening it grants nothing; "Request edit access" goes through
 * the access request form, and people who already have access get a
 * link to the collection. The API client while `publicSharing` is off.
 */
export function GuestCollectionPage() {
	const { publicSharing } = useFeatures();
	const { linkId = "" } = useParams();
	if (!publicSharing) return <Navigate to="/api-client" replace />;
	return <GuestCollection key={linkId} linkId={linkId} />;
}
