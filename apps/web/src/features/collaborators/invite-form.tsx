import { IconPlus } from "@tabler/icons-react";
import { type RefObject, useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import {
	CopyField,
	type CopyFieldHandle,
} from "../../components/ui/copy-field";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { formatDate } from "../../lib/format";
import type { InviteResult } from "./collaborators-api";
import { InviteeCard } from "./invitee-card";
import { useInviteFlow } from "./use-invite-flow";

export interface InviteFormProps {
	projectId: string;
	/** No free seat: the fieldset is disabled. */
	disabled: boolean;
	inputRef: RefObject<HTMLInputElement | null>;
	onInvited: (result: InviteResult, message: string) => void;
	onPlanLimit: () => void;
}

/**
 * Invite by username or email in two steps: "Mời" looks the account up,
 * then the owner confirms the card. The one-time link appears once below.
 */
export function InviteForm({
	projectId,
	disabled,
	inputRef,
	onInvited,
	onPlanLimit,
}: InviteFormProps) {
	const flow = useInviteFlow({ projectId, onInvited, onPlanLimit });
	const { candidate, created } = flow;
	const copyField = useRef<CopyFieldHandle>(null);

	// After inviting: back to the input, or to the link when it must be sent.
	useEffect(() => {
		if (!created) return;
		const input = inputRef.current;
		if (!created.copyNow && input && !input.matches(":disabled")) {
			input.focus();
		} else {
			copyField.current?.focusCopyButton();
		}
	}, [created, inputRef]);

	return (
		<>
			<fieldset
				disabled={disabled}
				className="m-0 grid min-w-0 gap-3 border-0 p-0"
			>
				<legend className="sr-only">Mời cộng tác viên</legend>
				<form
					className="grid gap-3"
					noValidate
					onSubmit={(event) => {
						event.preventDefault();
						void flow.look();
					}}
				>
					<FormField
						label="Username hoặc email"
						hint="Người chưa có tài khoản hoandat: nhập email để tạo link mời dùng 1 lần (7 ngày)."
						error={flow.error ?? undefined}
						announceError
					>
						<div className="flex gap-2">
							<Input
								ref={inputRef}
								value={flow.value}
								placeholder="@username hoặc ten@example.com"
								autoComplete="off"
								data-id="modal-collaborators-email"
								// Locked while the invitation is sent, so the card matches.
								readOnly={flow.confirming}
								className="min-w-0 flex-1"
								onChange={(event) => flow.change(event.target.value)}
							/>
							<Button
								type="submit"
								variant="primary"
								data-id="modal-collaborators-invite"
								disabled={flow.checking || flow.confirming}
								className="min-h-11"
								leadingIcon={<IconPlus size={16} aria-hidden="true" />}
							>
								{flow.checking ? "Đang tìm…" : "Mời"}
							</Button>
						</div>
					</FormField>
				</form>
				<div aria-live="polite" className="grid">
					{candidate ? (
						<InviteeCard
							candidate={candidate}
							busy={flow.confirming}
							onConfirm={() => void flow.confirm(candidate)}
							onCancel={() => {
								flow.cancel();
								inputRef.current?.focus();
							}}
						/>
					) : null}
				</div>
			</fieldset>
			{created ? (
				<CopyField
					key={created.url}
					ref={copyField}
					label={`Link mời cho ${created.who}`}
					value={created.url}
					hint={`${created.expiresAt ? `Hết hạn ${formatDate(created.expiresAt)}. ` : ""}Link chỉ hiện lần này.`}
					autoCopy={created.copyNow}
					data-id="modal-collaborators-link"
					copyDataId="modal-collaborators-link-copy"
				/>
			) : null}
		</>
	);
}
