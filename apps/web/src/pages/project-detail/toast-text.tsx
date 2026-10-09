import type { ReactNode } from "react";
import { renderRich } from "../../i18n/rich-text";

const RESOURCE_NAME = {
	code: (name: string) => <b className="font-mono">{name}</b>,
};

/**
 * Toast text of the project page: `<code>` marks a resource name (bold
 * mono), `<b>` a count.
 */
export function toastText(text: string): ReactNode {
	return renderRich(text, RESOURCE_NAME);
}
