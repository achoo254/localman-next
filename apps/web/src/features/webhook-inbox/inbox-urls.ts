import { splitMockBaseUrl } from "../../pages/project-detail/mock-url-parts";
import type { Project } from "../../pages/projects/projects-api";

/** Path segment of every inbox, as the request log shows it. */
const INBOX_SEGMENT = "/_inbox/";

/** The request log filter of one inbox's requests. */
export interface InboxLogFilter {
	source: "inbox";
	path: string;
}

export function inboxLogFilter(name: string): InboxLogFilter {
	return { source: "inbox", path: `${INBOX_SEGMENT}${name}` };
}

/** `https://{secret}.{mock host}/_inbox/`, outside the project prefix. */
export function inboxUrlBase(project: Project): string {
	const url = splitMockBaseUrl(
		project.mockBaseUrl,
		project.secret,
		project.prefix,
	);
	return `${url.scheme}${url.secret ?? ""}${url.host}${INBOX_SEGMENT}`;
}
