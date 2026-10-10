import { Link } from "react-router";
import { Badge, type BadgeTone } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useI18n } from "../../i18n/i18n-context";
import { PersonAvatar } from "../collaborators/person-avatar";
import type { AccessRequest, AccessRequestStatus } from "./access-requests-api";
import { elementPath } from "./sharing-api";
import { elementRoleLabel } from "./use-element-access";
import { type Resolution, requesterName } from "./use-resolve-access-request";

const STATUS_TONE: Record<AccessRequestStatus, BadgeTone> = {
	pending: "warning",
	approved: "success",
	denied: "neutral",
};

export interface AccessRequestCardProps {
	request: AccessRequest;
	/** The resolution in flight, if any. */
	busy: Resolution["action"] | null;
	onResolve: (resolution: Resolution) => void;
}

/** Who asks, for what and why; Approve and Deny while it is pending. */
export function AccessRequestCard({
	request,
	busy,
	onResolve,
}: AccessRequestCardProps) {
	const { t, formatDate } = useI18n();
	const name = requesterName(request, t);
	const { element } = request;
	return (
		<Card
			data-id="access-request-page"
			className="mx-auto grid w-full max-w-md gap-4 p-6"
		>
			<div className="flex items-center gap-3">
				<PersonAvatar name={name} picture={request.requester.picture} />
				<h1 className="m-0 min-w-0 break-words font-bold font-mono text-xl">
					{t("sharing.requestPage.asks", {
						name,
						role: elementRoleLabel(request.role, t),
					})}
				</h1>
			</div>
			<dl className="m-0 grid gap-3 text-sm">
				<div className="grid gap-1">
					<dt className="font-mono font-semibold text-[0.8125rem]">
						{t("sharing.requestPage.element")}
					</dt>
					<dd className="m-0 flex flex-wrap items-center gap-2">
						<Badge tone="neutral">{t(`sharing.types.${element.type}`)}</Badge>
						<Link
							to={elementPath(element.type, element.id)}
							data-id="access-request-element"
							className="break-words"
						>
							{element.name}
						</Link>
					</dd>
				</div>
				{request.message ? (
					<div className="grid gap-1">
						<dt className="font-mono font-semibold text-[0.8125rem]">
							{t("sharing.requestPage.message")}
						</dt>
						<dd
							data-id="access-request-message"
							className="m-0 whitespace-pre-wrap break-words rounded-md border border-border-subtle bg-surface-subtle p-3"
						>
							{request.message}
						</dd>
					</div>
				) : null}
			</dl>
			<p className="m-0 flex flex-wrap items-center gap-2 text-muted text-[0.8125rem]">
				<Badge
					tone={STATUS_TONE[request.status]}
					data-id="access-request-status"
				>
					{t(`sharing.requestPage.${request.status}`)}
				</Badge>
				{t("sharing.requestPage.requested", {
					date: formatDate(request.createdAt),
				})}
			</p>
			{request.status === "pending" ? (
				<div className="grid grid-cols-2 gap-3">
					<Button
						data-id="access-request-deny"
						loading={busy === "deny"}
						disabled={busy === "approve"}
						onClick={() => onResolve({ action: "deny", requestId: request.id })}
					>
						{t("sharing.requestPage.deny")}
					</Button>
					<Button
						variant="primary"
						data-id="access-request-approve"
						loading={busy === "approve"}
						disabled={busy === "deny"}
						onClick={() =>
							onResolve({
								action: "approve",
								requestId: request.id,
								role: request.role,
							})
						}
					>
						{t("sharing.requestPage.approve")}
					</Button>
				</div>
			) : null}
		</Card>
	);
}
