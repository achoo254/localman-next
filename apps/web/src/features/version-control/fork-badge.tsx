import type { ForkInfo } from "@localman/shared/api-client";
import { IconGitFork } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { useI18n } from "../../i18n/i18n-context";
import type { ForkTarget } from "./forks-api";
import { useForkActions } from "./use-forks";

/** "Fork: label" with where it came from; Editors rename the label. */
export function ForkBadge({
	target,
	fork,
	canEdit,
}: {
	target: ForkTarget;
	fork: ForkInfo;
	canEdit: boolean;
}) {
	const { t, formatDate } = useI18n();
	const { relabel } = useForkActions(target);
	const [editing, setEditing] = useState<string | null>(null);
	const person = fork.createdByName ?? "?";
	const date = formatDate(fork.createdAt);
	const origin = fork.source.available
		? t("versionControl.badge.from", {
				name: fork.source.name ?? "",
				person,
				date,
			})
		: t("versionControl.badge.sourceGone", { person, date });
	return (
		<>
			<button
				type="button"
				data-id="fork-badge"
				title={origin}
				disabled={!canEdit}
				aria-label={`${t("versionControl.badge.label", { label: fork.label })}. ${origin}`}
				className="inline-flex min-h-7 items-center gap-1 rounded-full border border-primary/40 bg-primary/8 px-2 font-mono text-primary text-xs enabled:cursor-pointer enabled:hover:bg-primary/14"
				onClick={() => setEditing(fork.label)}
			>
				<IconGitFork size={14} aria-hidden="true" />
				{fork.label}
			</button>
			{editing !== null ? (
				<Modal
					open
					onOpenChange={(open) => {
						if (!open) setEditing(null);
					}}
					title={t("versionControl.badge.rename")}
					description={origin}
					size="sm"
					footer={
						<ModalFooter>
							<ModalClose asChild>
								<Button variant="ghost">{t("common.actions.cancel")}</Button>
							</ModalClose>
							<Button
								data-id="fork-relabel-save"
								loading={relabel.isPending}
								disabled={editing.trim() === ""}
								onClick={() =>
									relabel.mutate(editing.trim(), {
										onSuccess: () => setEditing(null),
									})
								}
							>
								{t("versionControl.badge.save")}
							</Button>
						</ModalFooter>
					}
				>
					<FormField label={t("versionControl.badge.renameLabel")}>
						<Input
							value={editing}
							maxLength={64}
							data-id="fork-relabel-input"
							onChange={(event) => setEditing(event.target.value)}
						/>
					</FormField>
				</Modal>
			) : null}
		</>
	);
}
