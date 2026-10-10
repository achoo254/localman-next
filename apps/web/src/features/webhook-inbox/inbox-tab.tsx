import { IconPlus, IconWebhook } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Suspense, lazy, useId, useRef, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { splitMockBaseUrl } from "../../pages/project-detail/mock-url-parts";
import type { Project } from "../../pages/projects/projects-api";
import { ReadonlyNote } from "../upstream/readonly-note";
import { DeleteInboxModal } from "./delete-inbox-modal";
import { type InboxView, fetchInboxes, inboxesKey } from "./inbox-api";
import { InboxItem } from "./inbox-item";

const InboxFormModal = lazy(async () => ({
	default: (await import("./inbox-form-modal")).InboxFormModal,
}));

/** Path segment of every inbox, as the request log shows it. */
const INBOX_SEGMENT = "/_inbox/";

/** The request log filter of one inbox's requests. */
export interface InboxLogFilter {
	source: "inbox";
	path: string;
}

export interface InboxTabProps {
	project: Project;
	/** Opens the request log tab with this filter. */
	onShowLogs: (filter: InboxLogFilter) => void;
	/** The owner's plan has no room for another inbox: open the plans. */
	onPlanLimit: () => void;
}

type Dialog =
	| { kind: "none" }
	| { kind: "form"; inbox: InboxView | null }
	| { kind: "delete"; inbox: InboxView };

/** `https://{secret}.{mock host}/_inbox/`, outside the project prefix. */
function inboxUrlBase(project: Project): string {
	const url = splitMockBaseUrl(
		project.mockBaseUrl,
		project.secret,
		project.prefix,
	);
	return `${url.scheme}${url.secret ?? ""}${url.host}${INBOX_SEGMENT}`;
}

/**
 * The Inbox tab of the endpoint card: the project's webhook inboxes with
 * their count against the plan, create, edit and delete for the owner,
 * read only for collaborators.
 */
export function InboxTab({ project, onShowLogs, onPlanLimit }: InboxTabProps) {
	const t = useT();
	const titleId = useId();
	const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
	const createButton = useRef<HTMLButtonElement>(null);
	const query = useQuery({
		queryKey: inboxesKey(project.id),
		queryFn: () => fetchInboxes(project.id),
	});
	const close = () => setDialog({ kind: "none" });

	let body = null;
	let manage = false;
	if (query.isPending) {
		body = (
			<p className="m-0 text-muted text-sm">{t("webhookInbox.loading")}</p>
		);
	} else if (query.isError) {
		body = (
			<Alert tone="danger">
				{t("webhookInbox.loadFailed")}{" "}
				<Button size="sm" variant="ghost" onClick={() => void query.refetch()}>
					{t("common.cta.retry")}
				</Button>
			</Alert>
		);
	} else {
		const { items, used, max, canManage } = query.data;
		manage = canManage;
		const create = () =>
			used >= max ? onPlanLimit() : setDialog({ kind: "form", inbox: null });
		body = (
			<>
				<div className="flex flex-wrap items-center gap-3">
					<span className="font-mono text-muted text-sm" data-id="inbox-count">
						{t("webhookInbox.count", { used, max })}
					</span>
					{canManage ? (
						<Button
							ref={createButton}
							variant="primary"
							size="sm"
							leadingIcon={<IconPlus size={16} aria-hidden="true" />}
							onClick={create}
							data-id="inbox-new"
						>
							{t("webhookInbox.create")}
						</Button>
					) : null}
				</div>
				{canManage ? null : (
					<ReadonlyNote data-id="inbox-readonly">
						{t("webhookInbox.readonly")}
					</ReadonlyNote>
				)}
				{items.length === 0 ? (
					<EmptyState
						icon={<IconWebhook size={32} aria-hidden="true" />}
						title={t("webhookInbox.empty.title")}
						data-id="inbox-empty"
						action={
							canManage ? (
								<Button
									variant="primary"
									onClick={create}
									data-id="inbox-empty-new"
								>
									{t("webhookInbox.create")}
								</Button>
							) : null
						}
					>
						{t("webhookInbox.empty.body")}
					</EmptyState>
				) : (
					<ul className="m-0 grid list-none gap-3 p-0" data-id="inbox-list">
						{items.map((inbox) => (
							<InboxItem
								key={inbox.id}
								inbox={inbox}
								manage={canManage}
								onShowLogs={() =>
									onShowLogs({
										source: "inbox",
										path: `${INBOX_SEGMENT}${inbox.name}`,
									})
								}
								onEdit={() => setDialog({ kind: "form", inbox })}
								onDelete={() => setDialog({ kind: "delete", inbox })}
							/>
						))}
					</ul>
				)}
			</>
		);
	}

	return (
		<section aria-labelledby={titleId} className="grid gap-4 p-6">
			<div className="grid gap-1">
				<h2
					id={titleId}
					className="m-0 font-mono font-semibold text-[0.8125rem] text-muted"
				>
					{t("webhookInbox.title")}
				</h2>
				<p className="m-0 text-muted text-sm">{t("webhookInbox.intro")}</p>
			</div>
			{body}
			<p className="m-0 text-muted text-sm">
				{renderRich(t("webhookInbox.footnote"))}
			</p>
			{dialog.kind === "form" && manage ? (
				<Suspense fallback={null}>
					<InboxFormModal
						projectId={project.id}
						inbox={dialog.inbox}
						urlBase={inboxUrlBase(project)}
						onOpenChange={(open) => !open && close()}
						onPlanLimit={() => {
							close();
							onPlanLimit();
						}}
					/>
				</Suspense>
			) : null}
			{dialog.kind === "delete" ? (
				<DeleteInboxModal
					projectId={project.id}
					name={dialog.inbox.name}
					onClose={close}
					focusAfterDelete={() => createButton.current?.focus()}
				/>
			) : null}
		</section>
	);
}
