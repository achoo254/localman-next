import type { RefObject } from "react";
import { Button } from "../../components/ui/button";
import { ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";

/** Ghost button in the error colour (`!` wins over the ghost's muted text). */
export const DANGER_GHOST = "text-error! enabled:hover:text-error!";

export interface CollaboratorsFooterProps {
	canManage: boolean;
	closeRef: RefObject<HTMLButtonElement | null>;
	/** Collaborator view: "Rời project", when their own row is known. */
	onLeave: (() => void) | null;
}

/** Owner: Đóng | Xong. Collaborator: Rời project | Đóng. */
export function CollaboratorsFooter({
	canManage,
	closeRef,
	onLeave,
}: CollaboratorsFooterProps) {
	const close = (
		<ModalClose asChild>
			<Button ref={closeRef} data-id="modal-collaborators-close">
				Đóng
			</Button>
		</ModalClose>
	);
	if (canManage) {
		return (
			<ModalFooter>
				{close}
				<ModalClose asChild>
					<Button variant="primary" data-id="modal-collaborators-done">
						Xong
					</Button>
				</ModalClose>
			</ModalFooter>
		);
	}
	return (
		<ModalFooter>
			{onLeave ? (
				<Button
					variant="ghost"
					data-id="modal-collaborators-leave"
					className={DANGER_GHOST}
					onClick={onLeave}
				>
					Rời project
				</Button>
			) : null}
			{close}
		</ModalFooter>
	);
}
