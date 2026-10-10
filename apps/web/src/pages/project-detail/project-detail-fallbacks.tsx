import { IconBox } from "@tabler/icons-react";
import { Link } from "react-router";
import { Alert } from "../../components/ui/alert";
import { Button, buttonClassName } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";

export interface ProjectLoadErrorProps {
	error: unknown;
	retrying: boolean;
	onRetry: () => void;
}

/** `GET /projects/:id` failed: the reason and a retry button. */
export function ProjectLoadError({
	error,
	retrying,
	onRetry,
}: ProjectLoadErrorProps) {
	const t = useT();
	return (
		<div
			data-id="project-detail-error"
			className="grid justify-items-start gap-3"
		>
			<Alert tone="danger" title={t("projectDetail.loadFailed")}>
				{errorMessage(error)}
			</Alert>
			<Button loading={retrying} onClick={onRetry}>
				{t("common.cta.retry")}
			</Button>
		</div>
	);
}

/** The project does not exist or is not shared with the user. */
export function ProjectMissing() {
	const t = useT();
	return (
		<EmptyState
			data-id="project-missing"
			headingLevel={1}
			icon={<IconBox size={32} aria-hidden="true" />}
			title={t("projectDetail.missing.title")}
			action={
				<Link
					to="/projects"
					className={buttonClassName({ variant: "primary" })}
					data-id="project-missing-back"
				>
					{t("projectDetail.missing.back")}
				</Link>
			}
		>
			{t("projectDetail.missing.body")}
		</EmptyState>
	);
}
