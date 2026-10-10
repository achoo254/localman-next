import type { NavigateFunction } from "react-router";
import { useT } from "../../i18n/i18n-context";
import { isPlainLeftClick } from "../../lib/is-plain-left-click";
import type { Project } from "./projects-api";

export interface OpenProjectLinkProps {
	project: Project;
	/** The page's `navigate`: toasts render outside the router's context. */
	navigate: NavigateFunction;
}

/**
 * "Open project" in the toast after a project is created: a real link, so
 * a modified click opens a new tab; a plain click routes in the app.
 */
export function OpenProjectLink({ project, navigate }: OpenProjectLinkProps) {
	const t = useT();
	const path = `/projects/${encodeURIComponent(project.id)}`;
	return (
		<a
			href={path}
			data-id="projects-toast-open"
			className="font-medium underline underline-offset-4"
			onClick={(event) => {
				if (!isPlainLeftClick(event)) return;
				event.preventDefault();
				void navigate(path);
			}}
		>
			{t("projects.toast.open")}
		</a>
	);
}
