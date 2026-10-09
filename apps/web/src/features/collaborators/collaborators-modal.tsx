import type { PlanId } from "@localman/shared/constants";
import { useEffect, useRef, useState } from "react";
import { Modal } from "../../components/ui/modal";
import { useToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import type { Project } from "../../pages/projects/projects-api";
import { useCurrentUser } from "../auth/use-current-user";
import { collaboratorLabel, memberName } from "./collaborator-labels";
import { CollaboratorList } from "./collaborator-list";
import { type Collaborator, removeCollaborator } from "./collaborators-api";
import { CollaboratorsFooter } from "./collaborators-footer";
import { InviteForm } from "./invite-form";
import { type MemberConfirm, MemberConfirmModal } from "./member-confirm-modal";
import { MemberSeatsGate, seatsFull } from "./member-seats-gate";
import { RotateSecretHint } from "./rotate-secret-hint";
import { memberCountOf, useCollaborators } from "./use-collaborators";
import { useRowFocus } from "./use-row-focus";

export interface CollaboratorsModalProps {
	project: Project;
	/** Plan of the signed-in user: the owner's plan when they manage. */
	plan: PlanId;
	onOpenChange: (open: boolean) => void;
	/** Opens "Manage plan" for the member limit. */
	onPlans: () => void;
	/** Owner plus accepted members, whenever the list changes (keep stable). */
	onMemberCount: (projectId: string, count: number) => void;
	/** The collaborator left: the caller closes the dialog and moves on. */
	onLeft: (project: Project) => void;
	/** The owner changed the mock URL (new secret) from the removal hint. */
	onProjectChange: (project: Project) => void;
	/** See `Modal`; lets the caller place focus after leaving. */
	onCloseAutoFocus?: (event: Event) => void;
}

/** Members of a project: the owner invites and removes, a collaborator may leave. */
export function CollaboratorsModal({
	project,
	plan,
	onOpenChange,
	onPlans,
	onMemberCount,
	onLeft,
	onProjectChange,
	onCloseAutoFocus,
}: CollaboratorsModalProps) {
	const toast = useToast();
	const i18n = useI18n();
	const { t } = i18n;
	const session = useCurrentUser();
	const viewerSub =
		session.status === "authenticated" ? session.user.sub : null;
	const input = useRef<HTMLInputElement>(null);
	const close = useRef<HTMLButtonElement>(null);
	const list = useRef<HTMLUListElement>(null);
	const [confirm, setConfirm] = useState<MemberConfirm | null>(null);
	// A joined member was removed: suggest changing the mock URL they know.
	const [rotateHint, setRotateHint] = useState(false);
	// Read inside the dialog, where toasts are hidden from screen readers.
	const [announcement, setAnnouncement] = useState("");
	const removedByConfirm = useRef(false);
	const focus = useRowFocus({ list, input, close });
	const members = useCollaborators(project.id, focus.beforeGone);
	const ready = members.state.status === "ready" ? members.state.list : null;
	const canManage = ready?.canManage ?? false;
	const self = ready?.items.find((item) => item.user?.sub === viewerSub);

	const count = ready ? memberCountOf(ready) : null;
	useEffect(() => {
		if (count !== null) onMemberCount(project.id, count);
	}, [count, onMemberCount, project.id]);

	// The input appears once the list has loaded; focus it if nothing else has focus.
	useEffect(() => {
		if (!canManage) return;
		const active = document.activeElement;
		if (
			!active ||
			active === document.body ||
			active.getAttribute("role") === "dialog"
		) {
			input.current?.focus();
		}
	}, [canManage]);

	function done(message: string) {
		toast.show({ title: message });
		setAnnouncement(message);
	}

	/** Pending and expired invitations go at once, without confirmation. */
	async function cancelInvite(item: Collaborator) {
		focus.remember(item.id);
		try {
			if (await members.remove(item)) {
				const label = collaboratorLabel(item, i18n);
				done(t("collaborators.toast.inviteCancelled", { label }));
			}
		} catch (error) {
			toast.show({ tone: "error", title: errorMessage(error) });
		}
	}

	async function confirmed({ item, leave }: MemberConfirm) {
		if (leave) {
			await removeCollaborator(project.id, item.id);
			toast.show({
				title: t("collaborators.toast.left", { project: project.name }),
			});
			onLeft(project);
			return;
		}
		focus.remember(item.id);
		if (!(await members.remove(item))) return;
		removedByConfirm.current = true;
		setRotateHint(true);
		const name = memberName(item, i18n);
		done(t("collaborators.toast.removed", { name }));
	}

	return (
		<Modal
			open
			onOpenChange={onOpenChange}
			title={t("collaborators.modal.title", { project: project.name })}
			initialFocusRef={project.role === "owner" ? input : close}
			onCloseAutoFocus={onCloseAutoFocus}
			data-id="modal-collaborators"
			footer={
				<CollaboratorsFooter
					canManage={canManage}
					closeRef={close}
					onLeave={self ? () => setConfirm({ item: self, leave: true }) : null}
				/>
			}
		>
			<MemberSeatsGate
				seats={ready?.seats ?? null}
				plan={plan}
				canManage={canManage}
				onPlans={onPlans}
			/>
			{canManage && ready ? (
				<InviteForm
					projectId={project.id}
					disabled={seatsFull(ready.seats)}
					inputRef={input}
					onInvited={(result, message) => {
						members.add(result.collaborator);
						setAnnouncement(message);
					}}
					onPlanLimit={() => {
						// Keep the list, the form and a link shown once on screen.
						void members.load({ background: true });
						if (plan === "free") onPlans();
					}}
				/>
			) : null}
			{rotateHint ? (
				<RotateSecretHint project={project} onRotated={onProjectChange} />
			) : null}
			<CollaboratorList
				state={members.state}
				leaving={members.leaving}
				removing={members.removing}
				refreshing={members.refreshing}
				viewerSub={viewerSub}
				listRef={list}
				onRetry={() => void members.load()}
				onRemove={(item) =>
					item.status === "accepted"
						? setConfirm({ item, leave: false })
						: void cancelInvite(item)
				}
				onGone={members.drop}
			/>
			<output
				aria-live="polite"
				data-id="modal-collaborators-status"
				className="sr-only"
			>
				{announcement}
			</output>
			<MemberConfirmModal
				projectName={project.name}
				confirm={confirm}
				onClose={() => setConfirm(null)}
				onConfirm={confirmed}
				onCloseAutoFocus={(event) => {
					if (!removedByConfirm.current) return;
					removedByConfirm.current = false;
					event.preventDefault();
					focus.restore();
				}}
			/>
		</Modal>
	);
}
