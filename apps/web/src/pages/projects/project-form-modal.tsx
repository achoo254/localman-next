import { normalizePrefix } from "@localman/shared";
import { type FormEvent, useId, useRef, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { errorMessage } from "../../lib/api-client";
import {
	type ProjectFormErrors,
	mockUrlPreview,
	validateProject,
} from "./project-validation";
import {
	type Project,
	type ProjectInput,
	isPlanLimitError,
} from "./projects-api";

export interface ProjectFormModalProps {
	/** Project being edited, or null to create one. */
	project: Project | null;
	/** Masked base URL used to preview a new project's mock URL. */
	sampleBaseUrl: string | null;
	onOpenChange: (open: boolean) => void;
	onSave: (input: ProjectInput) => Promise<void>;
	/** The plan has no room for another project. */
	onPlanLimit: () => void;
}

/** "Project mới" / "Sửa project". Mount it only while open. */
export function ProjectFormModal({
	project,
	sampleBaseUrl,
	onOpenChange,
	onSave,
	onPlanLimit,
}: ProjectFormModalProps) {
	const formId = useId();
	const nameInput = useRef<HTMLInputElement>(null);
	const editing = project !== null;
	const [name, setName] = useState(project?.name ?? "");
	const [prefix, setPrefix] = useState(project?.prefix ?? "");
	const [errors, setErrors] = useState<ProjectFormErrors>({});
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (busy) return;
		const result = validateProject(name, prefix);
		setErrors(result.errors);
		if (!result.input) return;
		setPrefix(result.input.prefix);
		setBusy(true);
		setSubmitError(null);
		try {
			await onSave(result.input);
		} catch (error) {
			if (isPlanLimitError(error)) onPlanLimit();
			else setSubmitError(errorMessage(error));
		} finally {
			setBusy(false);
		}
	}

	const preview = mockUrlPreview(
		editing ? project.mockBaseUrl : sampleBaseUrl,
		project?.prefix ?? "",
		prefix,
	);

	return (
		<Modal
			open
			onOpenChange={(open) => !busy && onOpenChange(open)}
			title={editing ? "Sửa project" : "Project mới"}
			size="md"
			initialFocusRef={nameInput}
			data-id={editing ? "modal-edit-project" : "modal-new-project"}
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost" disabled={busy}>
							Huỷ
						</Button>
					</ModalClose>
					<Button
						type="submit"
						form={formId}
						variant="primary"
						disabled={busy}
						data-id="project-form-submit"
					>
						{editing ? "Lưu thay đổi" : "Tạo project"}
					</Button>
				</ModalFooter>
			}
		>
			<form
				id={formId}
				noValidate
				onSubmit={submit}
				data-id="project-form"
				className="grid gap-4"
			>
				<FormField
					label="Tên project"
					required
					error={errors.name}
					data-id="project-form-name"
				>
					<Input
						ref={nameInput}
						placeholder="Demo shop"
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</FormField>
				<FormField
					label="API Prefix"
					error={errors.prefix}
					data-id="project-form-prefix"
					hint={
						<>
							Thêm vào trước mọi endpoint, ví dụ <code>/api/v1</code>. Để trống
							nếu không cần. Chỉ dùng chữ, số, <code>-</code>, <code>_</code> và{" "}
							<code>/</code>.
						</>
					}
				>
					<Input
						placeholder="/api/v1"
						value={prefix}
						onChange={(event) => setPrefix(event.target.value)}
						onBlur={() => setPrefix(normalizePrefix(prefix))}
					/>
				</FormField>
				<div className="grid gap-1.5" data-id="project-form-preview">
					<span className="font-mono font-semibold text-[0.8125rem]">
						Xem trước
					</span>
					<output className="break-all font-mono text-[0.8125rem] text-muted">
						{preview}
					</output>
				</div>
				{submitError ? <Alert tone="danger">{submitError}</Alert> : null}
			</form>
		</Modal>
	);
}
