import {
	type KeptResponse,
	parseResponseReference,
	valueOfReference,
} from "@localman/shared/api-client";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { ScopeBadge } from "./scope-badge";

export interface ReferenceCardProps {
	/** The text between the braces: `response "<request>" "<path>"`. */
	expression: string;
	/** The last response of a request of the collection, by name. */
	keptFor: (requestName: string) => KeptResponse | undefined;
}

const VALUE_BOX =
	"break-all rounded-xs border border-border-subtle bg-surface-subtle px-2 py-1 font-mono text-xs";

/** The value now, or why there is none, from the kept response. */
function currentValue(
	expression: string,
	kept: KeptResponse | undefined,
): string | null {
	const reference = parseResponseReference(expression);
	if (!reference || !kept) return null;
	try {
		return valueOfReference(reference, kept.response);
	} catch {
		return null;
	}
}

/**
 * The card of a `{{response …}}`: which request and path it reads, how
 * long a response stays fresh, and the value it reads now when that
 * request's last response is kept in this tab.
 */
export function ReferenceCard({ expression, keptFor }: ReferenceCardProps) {
	const t = useT();
	const reference = parseResponseReference(expression);
	if (!reference) return null;
	const request = reference.requestName;
	const kept = keptFor(request);
	const value = currentValue(expression, kept);
	return (
		<div className="grid gap-2" data-id="var-tooltip-reference">
			<div className="flex items-center gap-2">
				<span className="min-w-0 truncate font-bold font-mono text-sm">
					{request}
				</span>
				<span className="ml-auto">
					<ScopeBadge scope="response" />
				</span>
			</div>
			<p className="m-0 text-muted text-xs">
				{renderRich(
					t("variables.reference.note", {
						request,
						path: reference.path,
						ttl: reference.ttlSeconds,
					}),
				)}
			</p>
			{value !== null ? (
				<div className="grid gap-1">
					<span className="text-muted text-xs">
						{t("variables.reference.value")}
					</span>
					<span className={VALUE_BOX} data-id="var-tooltip-reference-value">
						{value}
					</span>
				</div>
			) : (
				<p
					className="m-0 text-muted text-xs"
					data-id="var-tooltip-reference-none"
				>
					{t(
						kept
							? "variables.reference.missing"
							: "variables.reference.notSent",
						{ request },
					)}
				</p>
			)}
		</div>
	);
}
