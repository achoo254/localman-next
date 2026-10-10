import { IconLockOff } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router";
import { PageLoading } from "../../components/layout/page-loading";
import { Alert } from "../../components/ui/alert";
import { Button, buttonClassName } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { useAppTitle } from "../../lib/use-document-title";
import { useWorkspacesEnabled } from "../workspaces/use-workspaces-enabled";
import { AccessRequestCard } from "./access-request-card";
import { fetchAccessRequest } from "./access-requests-api";
import { isNotFound, sharingErrorMessage } from "./sharing-errors";
import { useResolveAccessRequest } from "./use-resolve-access-request";

export const accessRequestKey = (requestId: string) =>
	["access-requests", requestId] as const;

function AccessRequestDetails({ requestId }: { requestId: string }) {
	const t = useT();
	const client = useQueryClient();
	const key = accessRequestKey(requestId);
	const query = useQuery({
		queryKey: key,
		queryFn: () => fetchAccessRequest(requestId),
	});
	const resolve = useResolveAccessRequest({
		onResolved: (request) => client.setQueryData(key, request),
		onStale: () => void query.refetch(),
	});

	if (query.isPending) return <PageLoading />;
	if (isNotFound(query.error)) {
		return (
			<EmptyState
				data-id="access-request-missing"
				headingLevel={1}
				icon={<IconLockOff size={32} aria-hidden="true" />}
				title={t("sharing.requestPage.notFoundTitle")}
				action={
					<Link
						to="/api-client"
						className={cn(
							buttonClassName({ variant: "primary" }),
							"no-underline",
						)}
					>
						{t("sharing.element.back")}
					</Link>
				}
			>
				{t("sharing.requestPage.notFoundText")}
			</EmptyState>
		);
	}
	if (!query.data) {
		return (
			<div className="mx-auto grid max-w-md gap-3 py-8 md:py-16">
				<h1 className="m-0 font-bold font-mono text-xl">
					{t("sharing.requestPage.loadFailed")}
				</h1>
				<Alert tone="danger">{sharingErrorMessage(query.error, t)}</Alert>
				<Button
					className="justify-self-start"
					onClick={() => void query.refetch()}
				>
					{t("common.cta.retry")}
				</Button>
			</div>
		);
	}
	return (
		<div className="py-8 md:py-16">
			<AccessRequestCard
				request={query.data}
				busy={resolve.isPending ? (resolve.variables?.action ?? null) : null}
				onResolve={(resolution) => resolve.mutate(resolution)}
			/>
		</div>
	);
}

function AccessRequestRoute() {
	const t = useT();
	useAppTitle(t("sharing.requestPage.pageTitle"));
	const { requestId = "" } = useParams();
	return <AccessRequestDetails key={requestId} requestId={requestId} />;
}

/** `/access-requests/:requestId`: the link of an `access.requested` notification. */
export function AccessRequestPage() {
	const workspaces = useWorkspacesEnabled();
	return workspaces ? (
		<AccessRequestRoute />
	) : (
		<Navigate to="/api-client" replace />
	);
}
