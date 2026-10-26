import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

/** Served from public/: a fixed URL, so the prerendered landing page and the client agree. */
const MARK_URL = "/brand/localman-mark-128.webp";

export type WordmarkProps = Omit<ComponentProps<"span">, "children">;

/**
 * The Localman logotype: the AI-drawn app mark (the same art as the app icon)
 * beside the name in the bold sans font, "Local" in violet step 11. At the
 * default 16px it matches the account app's top bar: a 24px mark and the
 * name beside it.
 */
export function Wordmark({ className, ...rest }: WordmarkProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-2 font-bold font-sans text-base text-fg",
				className,
			)}
			{...rest}
		>
			<img
				src={MARK_URL}
				alt=""
				aria-hidden="true"
				width={128}
				height={128}
				className="size-[1.5em] shrink-0"
				data-id="brand-mark"
			/>
			<span>
				<span className="text-primary">Local</span>man
			</span>
		</span>
	);
}
