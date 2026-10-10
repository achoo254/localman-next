import type { Project } from "../../pages/projects/projects-api";
import { useCurrentUser } from "../auth/use-current-user";
import { useShowRequestLog } from "../request-log/use-show-request-log";
import { useSubscriptionDialogs } from "../subscription/use-subscription-dialogs";
import { InboxTab } from "./inbox-tab";

/**
 * The Inbox tab of the project page: request counts open the filtered
 * request log, and the inbox limit opens the plans. Only the owner can
 * create an inbox, so the plan shown is the signed-in user's own.
 */
export function ProjectInboxTab({ project }: { project: Project }) {
	const session = useCurrentUser();
	const plan = session.status === "authenticated" ? session.user.plan : "free";
	const subscription = useSubscriptionDialogs(plan);
	const showRequestLog = useShowRequestLog();
	return (
		<>
			<InboxTab
				project={project}
				onShowLogs={showRequestLog}
				onPlanLimit={() => subscription.openPlans()}
			/>
			{subscription.element}
		</>
	);
}
