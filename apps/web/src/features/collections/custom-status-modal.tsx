import {
	STATUS_NAME_MAX,
	type StatusProblem,
	validateStatus,
} from "@localman/shared/api-client";
import { useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { STATUS_EMOJI_CHOICES } from "./status-display";

type CustomStatus = { kind: "custom"; name: string; emoji: string };

export interface CustomStatusModalProps {
	open: boolean;
	initial: CustomStatus | null;
	onOpenChange: (open: boolean) => void;
	onSave: (status: CustomStatus) => void;
}

const PROBLEM_KEYS = {
	"unknown-preset": "collections.status.problems.emoji",
	"name-length": "collections.status.problems.nameLength",
	"name-start": "collections.status.problems.nameStart",
	"name-characters": "collections.status.problems.nameCharacters",
	emoji: "collections.status.problems.emoji",
} as const satisfies Record<StatusProblem, string>;

/** A status of one's own: a name (2–64, starting with a letter) and one emoji. */
export function CustomStatusModal({
	open,
	initial,
	onOpenChange,
	onSave,
}: CustomStatusModalProps) {
	const t = useT();
	const nameRef = useRef<HTMLInputElement>(null);
	const [name, setName] = useState(initial?.name ?? "");
	const [emoji, setEmoji] = useState(initial?.emoji ?? STATUS_EMOJI_CHOICES[0]);
	const [tried, setTried] = useState(false);
	const status: CustomStatus = {
		kind: "custom",
		name: name.trim(),
		emoji: emoji.trim(),
	};
	const problem = validateStatus(status);
	const nameError =
		tried &&
		(problem === "name-length" ||
			problem === "name-start" ||
			problem === "name-characters")
			? t(PROBLEM_KEYS[problem], { min: 2, max: STATUS_NAME_MAX })
			: undefined;
	const emojiError =
		tried && problem === "emoji" ? t(PROBLEM_KEYS.emoji) : undefined;
	const submit = () => {
		setTried(true);
		if (!problem) onSave(status);
	};
	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={t("collections.status.customTitle")}
			size="sm"
			initialFocusRef={nameRef}
			data-id="modal-custom-status"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost">{t("common.actions.cancel")}</Button>
					</ModalClose>
					<Button
						variant="primary"
						data-id="modal-custom-status-submit"
						onClick={submit}
					>
						{t("collections.status.save")}
					</Button>
				</ModalFooter>
			}
		>
			<form
				className="grid gap-4"
				onSubmit={(event) => {
					event.preventDefault();
					submit();
				}}
			>
				<FormField
					label={t("collections.status.name")}
					error={nameError}
					announceError
				>
					<Input
						ref={nameRef}
						value={name}
						maxLength={STATUS_NAME_MAX}
						data-id="modal-custom-status-name"
						onChange={(event) => setName(event.target.value)}
					/>
				</FormField>
				<fieldset className="m-0 grid gap-2 border-0 p-0">
					<legend className="mb-1 font-semibold text-sm">
						{t("collections.status.emoji")}
					</legend>
					<div className="flex flex-wrap gap-1">
						{STATUS_EMOJI_CHOICES.map((choice) => (
							<button
								key={choice}
								type="button"
								aria-pressed={emoji === choice}
								aria-label={choice}
								data-id="modal-custom-status-emoji"
								className={cn(
									"grid size-9 cursor-pointer place-items-center rounded-sm border text-lg",
									emoji === choice
										? "border-primary bg-primary/10"
										: "border-border-subtle bg-transparent",
								)}
								onClick={() => setEmoji(choice)}
							>
								{choice}
							</button>
						))}
					</div>
					<FormField
						label={t("collections.status.emojiOther")}
						error={emojiError}
						announceError
					>
						<Input
							value={emoji}
							maxLength={16}
							className="max-w-24"
							data-id="modal-custom-status-emoji-input"
							onChange={(event) => setEmoji(event.target.value)}
						/>
					</FormField>
				</fieldset>
			</form>
		</Modal>
	);
}
