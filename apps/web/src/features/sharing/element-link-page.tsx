import type { ShareableElementType } from "@localman/shared/access";
import { IconLinkOff } from "@tabler/icons-react";
import { Link, Navigate, useParams } from "react-router";
import { PageLoading } from "../../components/layout/page-loading";
import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button, buttonClassName } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { useAppTitle } from "../../lib/use-document-title";
import { useWorkspacesEnabled } from "../workspaces/use-workspaces-enabled";
import { RequestAccessForm } from "./request-access-form";
import { isElementType } from "./sharing-api";
import { isNotFound, sharingErrorMessage } from "./sharing-errors";
import { elementRoleLabel, useElement } from "./use-element-access";

const BACK = cn(buttonClassName({ variant: "primary" }), "no-underline");

function ElementLink({
	type,
	id,
}: {
	type: ShareableElementType;
	id: string;
}) {
	const t = useT();
	const element = useElement(type, id);
	if (element.isPending) return <PageLoading />;
	// No access and no such element look the same: ask for access.
	if (isNotFound(element.error)) {
		return <RequestAccessForm elementType={type} elementId={id} />;
	}
	if (!element.data) {
		return (
			<div className="mx-auto grid max-w-md gap-3 py-8 md:py-16">
				<h1 className="m-0 font-bold font-mono text-xl">
					{t("sharing.element.loadFailed")}
				</h1>
				<Alert tone="danger">{sharingErrorMessage(element.error, t)}</Alert>
				<Button
					className="justify-self-start"
					onClick={() => void element.refetch()}
				>
					{t("common.cta.retry")}
				</Button>
			</div>
		);
	}
	const { data } = element;
	return (
		<div className="py-8 md:py-16">
			<Card
				data-id="element-page"
				className="mx-auto grid w-full max-w-md gap-4 p-6"
			>
				<h1
					data-id="element-page-name"
					className="m-0 break-words font-bold font-mono text-xl"
				>
					{data.name}
				</h1>
				<p className="m-0 flex flex-wrap items-center gap-2 text-sm">
					<Badge tone="neutral">{t(`sharing.types.${type}`)}</Badge>
					<span data-id="element-page-role">
						{t("sharing.element.role", {
							role: elementRoleLabel(data.role, t),
						})}
					</span>
				</p>
				<p className="m-0 text-muted text-sm">{t("sharing.element.soon")}</p>
				<Link to="/api-client" data-id="element-page-back" className={BACK}>
					{t("sharing.element.back")}
				</Link>
			</Card>
		</div>
	);
}

function ElementLinkRoute() {
	const t = useT();
	useAppTitle(t("sharing.element.pageTitle"));
	const { type, id = "" } = useParams();
	if (!isElementType(type) || id === "") {
		return (
			<EmptyState
				data-id="element-page-invalid"
				headingLevel={1}
				icon={<IconLinkOff size={32} aria-hidden="true" />}
				title={t("sharing.element.invalidTitle")}
				action={
					<Link to="/api-client" className={BACK}>
						{t("sharing.element.back")}
					</Link>
				}
			>
				{t("sharing.element.invalidText")}
			</EmptyState>
		);
	}
	return <ElementLink key={`${type}/${id}`} type={type} id={id} />;
}

/** `/elements/:type/:id`: a copied or notified link to a collection or environment. */
export function ElementLinkPage() {
	const workspaces = useWorkspacesEnabled();
	return workspaces ? (
		<ElementLinkRoute />
	) : (
		<Navigate to="/api-client" replace />
	);
}
