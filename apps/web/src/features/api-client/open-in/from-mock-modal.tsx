import { IconDatabase } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Modal, ModalClose } from "../../../components/ui/modal";
import { ModalFooter } from "../../../components/ui/modal-footer";
import { useT } from "../../../i18n/i18n-context";
import { renderRich } from "../../../i18n/rich-text";
import { errorMessage } from "../../../lib/api-client";
import { fetchProjects } from "../../../pages/projects/projects-api";

export interface FromMockModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The picked project; the caller opens its requests. */
	onPick: (projectId: string) => void;
}

/** Picks one of the user's mock projects to open as tabs. */
export function FromMockModal({
	open,
	onOpenChange,
	onPick,
}: FromMockModalProps) {
	const t = useT();
	const projects = useQuery({
		queryKey: ["projects", "api-client-from-mock"],
		queryFn: fetchProjects,
		enabled: open,
	});
	const [choice, setChoice] = useState<string | null>(null);
	const list = projects.data ?? [];
	// The first project until the user picks one.
	const picked =
		list.find((project) => project.id === choice)?.id ?? list[0]?.id ?? null;

	const submit = (): void => {
		if (picked === null) return;
		onPick(picked);
		onOpenChange(false);
	};

	let body = (
		<output className="block font-mono text-muted text-sm">
			{t("apiClientOpen.fromMock.loading")}
		</output>
	);
	if (projects.isError) {
		body = (
			<div className="grid justify-items-start gap-3">
				<Alert tone="danger" title={t("apiClientOpen.fromMock.loadFailed")}>
					{errorMessage(projects.error)}
				</Alert>
				<Button size="sm" onClick={() => void projects.refetch()}>
					{t("common.cta.retry")}
				</Button>
			</div>
		);
	} else if (projects.isSuccess && list.length === 0) {
		body = (
			<p data-id="modal-from-mock-empty" className="m-0 text-muted text-sm">
				{t("apiClientOpen.fromMock.empty")}
			</p>
		);
	} else if (projects.isSuccess) {
		body = (
			<fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
				<legend className="mb-2 font-mono font-semibold text-[0.8125rem]">
					{t("apiClientOpen.fromMock.legend")}
				</legend>
				{list.map((project) => (
					<label
						key={project.id}
						className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 has-checked:border-primary"
					>
						<input
							type="radio"
							name="from-mock-project"
							value={project.id}
							checked={picked === project.id}
							className="size-4 accent-primary"
							data-id={`modal-from-mock-${project.id}`}
							onChange={() => setChoice(project.id)}
						/>
						<IconDatabase
							size={16}
							aria-hidden="true"
							className="text-icon-muted"
						/>
						<span className="min-w-0 truncate font-mono font-semibold text-sm">
							{project.name}
						</span>
					</label>
				))}
			</fieldset>
		);
	}

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={t("apiClientOpen.fromMock.title")}
			description={renderRich(
				t("apiClientOpen.fromMock.intro", { example: "{{id}}" }),
			)}
			size="md"
			data-id="modal-from-mock"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost">{t("common.actions.cancel")}</Button>
					</ModalClose>
					<Button
						variant="primary"
						data-id="modal-from-mock-submit"
						disabled={picked === null || !projects.isSuccess}
						onClick={submit}
					>
						{t("apiClientOpen.fromMock.submit")}
					</Button>
				</ModalFooter>
			}
		>
			{body}
		</Modal>
	);
}
