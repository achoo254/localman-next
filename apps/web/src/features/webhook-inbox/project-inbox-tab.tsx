import type { Project } from "../../pages/projects/projects-api";
import { useShowRequestLog } from "../request-log/use-show-request-log";
import { useLimitNotice } from "../subscription/use-limit-notice";
import { InboxTab } from "./inbox-tab";

/**
 * The Inbox tab of the project page: request counts open the filtered
 * request log, and reaching the inbox limit says so in plain words. Only
 * the owner can create an inbox, so the limit is the signed-in user's.
 */
export function ProjectInboxTab({ project }: { project: Project }) {
	const limitNotice = useLimitNotice();
	const showRequestLog = useShowRequestLog();
	return (
		<InboxTab
			project={project}
			onShowLogs={showRequestLog}
			onPlanLimit={() => limitNotice("webhookInboxes")}
		/>
	);
}
