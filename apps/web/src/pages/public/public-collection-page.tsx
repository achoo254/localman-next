import { Navigate, useParams } from "react-router";
import { PageLoading } from "../../components/layout/page-loading";
import { useFeatures } from "../../config/features";
import { PublicCollectionLayout } from "../../features/public-sharing/public-collection-layout";
import { PublicViewError } from "../../features/public-sharing/public-view-error";
import { usePublicCollection } from "../../features/public-sharing/use-public-sharing";
import { useT } from "../../i18n/i18n-context";
import { useAppTitle } from "../../lib/use-document-title";

function PublicCollection({ linkId }: { linkId: string }) {
	const t = useT();
	const query = usePublicCollection(linkId);
	useAppTitle(query.data?.name ?? t("publicSharing.view.page.pageTitle"));
	if (query.isPending) return <PageLoading />;
	if (query.error) {
		return (
			<PublicViewError
				error={query.error}
				onRetry={() => void query.refetch()}
			/>
		);
	}
	return (
		<PublicCollectionLayout
			view={query.data}
			badge={t("publicSharing.view.page.readOnly")}
		/>
	);
}

/**
 * `/public/c/:linkId`: a collection published with a public link, read
 * only, no sign-in needed (the API is called without the sign-in
 * redirect). Home while `publicSharing` is off.
 */
export function PublicCollectionPage() {
	const { publicSharing } = useFeatures();
	const { linkId = "" } = useParams();
	if (!publicSharing) return <Navigate to="/" replace />;
	return <PublicCollection key={linkId} linkId={linkId} />;
}
