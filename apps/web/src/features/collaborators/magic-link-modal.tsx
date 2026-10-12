import { useEffect, useRef, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import {
	CopyField,
	type CopyFieldHandle,
} from "../../components/ui/copy-field";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { useToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { errorMessage } from "../../lib/api-client";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import type { Project } from "../../pages/projects/projects-api";
import { MagicLinkAction } from "./magic-link-action";
import {
	type MagicLinkConfirm,
	MagicLinkConfirmModal,
} from "./magic-link-confirm";
import { MagicLinkSkeleton } from "./magic-link-skeleton";
import { MagicLinkStatus } from "./magic-link-status";
import { seatsFull } from "./member-seats-gate";
import { useMagicLink } from "./use-magic-link";

export interface MagicLinkModalProps {
	project: Project;
	onOpenChange: (open: boolean) => void;
}

/**
 * The project's reusable invite link: create, replace or revoke it. The
 * link itself is shown only right after creating it.
 */
export function MagicLinkModal({ project, onOpenChange }: MagicLinkModalProps) {
	const toast = useToast();
	const { t, formatDate } = useI18n();
	const magic = useMagicLink(project.id);
	const { view, seats } = magic;
	const [confirm, setConfirm] = useState<MagicLinkConfirm | null>(null);
	const primary = useRef<HTMLButtonElement>(null);
	const copyField = useRef<CopyFieldHandle>(null);
	const created = view.status === "ready" ? view.created : null;
	const status = view.status === "ready" ? view.link.status : null;
	const skeleton = useDelayedFlag(view.status === "loading");

	// Focus follows the state: the main action once loaded, the copy button
	// once a link exists (unless focus already moved somewhere else).
	useEffect(() => {
		if (created) {
			copyField.current?.focusCopyButton();
			return;
		}
		const active = document.activeElement;
		if (status && (!active || active.getAttribute("role") === "dialog")) {
			primary.current?.focus();
		}
	}, [created, status]);

	return (
		<Modal
			open
			onOpenChange={onOpenChange}
			title={t("collaborators.magic.title", { project: project.name })}
			initialFocusRef={primary}
			data-id="modal-magic-link"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button data-id="modal-magic-link-close">
							{t("common.actions.close")}
						</Button>
					</ModalClose>
					<MagicLinkAction
						ref={primary}
						created={created !== null}
						status={status}
						creating={magic.creating}
						onCopy={() => void copyField.current?.copy()}
						onCreate={() => void magic.create()}
						onRegenerate={() => setConfirm("regenerate")}
					/>
				</ModalFooter>
			}
		>
			<p className="m-0 text-muted text-sm">
				{/* The project name goes in through the renderer, never parsed as tags. */}
				{renderRich(t("collaborators.magic.lead", { project: "" }), {
					b: () => <b>{project.name}</b>,
				})}
			</p>
			{seats && seatsFull(seats) && view.status === "ready" && !skeleton ? (
				<Alert tone="warning" data-id="modal-magic-link-full">
					{t("collaborators.magic.full", {
						used: seats.used,
						max: seats.max ?? "∞",
					})}
				</Alert>
			) : null}
			{skeleton ? <MagicLinkSkeleton /> : null}
			{view.status === "error" ? (
				<div className="grid justify-items-start gap-3">
					<Alert tone="danger" data-id="modal-magic-link-error">
						{errorMessage(view.error)}
					</Alert>
					<Button
						data-id="modal-magic-link-retry"
						onClick={() => void magic.load()}
					>
						{t("common.cta.retry")}
					</Button>
				</div>
			) : null}
			{view.status === "ready" && created ? (
				<div className="grid gap-3">
					<CopyField
						key={created}
						ref={copyField}
						label="Magic link"
						hideLabel
						value={created}
						data-id="modal-magic-link-input"
						copyDataId="modal-magic-link-copy"
					/>
					<Alert tone="warning">{t("collaborators.magic.shownOnce")}</Alert>
					<p
						data-id="modal-magic-link-expiry"
						className="m-0 text-muted text-[0.8125rem]"
					>
						{t("collaborators.magic.expires", {
							date: view.link.expiresAt ? formatDate(view.link.expiresAt) : "",
						})}
					</p>
				</div>
			) : null}
			{view.status === "ready" && !created && !skeleton ? (
				<MagicLinkStatus
					link={view.link}
					onRevoke={() => setConfirm("revoke")}
				/>
			) : null}
			<MagicLinkConfirmModal
				confirm={confirm}
				onClose={() => setConfirm(null)}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					primary.current?.focus();
				}}
				onConfirm={async (kind) => {
					if (kind === "revoke") {
						await magic.revoke();
						toast.show({ title: t("collaborators.magic.revoked") });
					} else {
						await magic.regenerate();
					}
				}}
			/>
		</Modal>
	);
}
