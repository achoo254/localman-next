import { HTTP_METHODS, type HttpMethod } from "@localman/shared/api-client";
import { IconChevronDown } from "@tabler/icons-react";
import { useT } from "../../../i18n/i18n-context";
import { cn } from "../../../lib/cn";
import { METHOD_TEXT_CLASS } from "../../../lib/method-tone";

function isMethod(value: string): value is HttpMethod {
	return HTTP_METHODS.some((method) => method === value);
}

/** HTTP method in its colour, at the start of the URL box. */
export function MethodSelect({
	value,
	onChange,
}: {
	value: HttpMethod;
	onChange: (method: HttpMethod) => void;
}) {
	const t = useT();
	return (
		<div className="relative flex-none">
			<select
				value={value}
				aria-label={t("apiClient.request.method")}
				data-id="request-method"
				className={cn(
					"h-full min-h-11 cursor-pointer appearance-none rounded-l-md border-0 border-border border-r bg-transparent pr-8 pl-3 font-bold font-mono text-[0.8125rem] focus:outline-none",
					METHOD_TEXT_CLASS[value],
				)}
				onChange={(event) => {
					const method = event.target.value;
					if (isMethod(method)) onChange(method);
				}}
			>
				{HTTP_METHODS.map((method) => (
					<option key={method} value={method} className="text-fg">
						{method}
					</option>
				))}
			</select>
			<IconChevronDown
				size={14}
				aria-hidden="true"
				className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-2 text-icon-muted"
			/>
		</div>
	);
}
