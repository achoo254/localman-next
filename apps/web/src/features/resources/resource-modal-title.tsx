import { renderRich } from "../../i18n/rich-text";
import { middleEllipsisParts } from "../../lib/middle-ellipsis";

/**
 * A resource name on one line, cut in the middle when space runs out
 * (`customer-rel…name-01`); the full name is in `title` and in the text.
 */
export function MiddleEllipsisName({ name }: { name: string }) {
	const { head, tail } = middleEllipsisParts(name);
	return (
		<span className="flex min-w-0" title={name}>
			<span className="truncate">{head}</span>
			{tail ? <span className="shrink-0">{tail}</span> : null}
		</span>
	);
}

/**
 * Title of a resource modal from a message holding `<name>{name}</name>`
 * ("Edit resource · <name>…</name>"): the words stay whole and the name
 * takes the middle ellipsis, so the title keeps one line at any width.
 */
export function ResourceModalTitle({ text }: { text: string }) {
	return (
		<span
			className="flex min-w-0 whitespace-pre"
			data-id="resource-modal-title"
		>
			{renderRich(text, {
				name: (name) => <MiddleEllipsisName name={name} />,
			})}
		</span>
	);
}
