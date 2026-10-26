import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";
import markUrl from "./localman-mark-128.webp";

export type WordmarkProps = Omit<ComponentProps<"span">, "children">;

/**
 * The Localman logotype: the AI-drawn app mark (the same art as the app icon)
 * beside the name in bold JetBrains Mono, "Local" in violet step 11.
 */
export function Wordmark({ className, ...rest }: WordmarkProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-2 font-bold font-mono text-fg text-xl tracking-[-0.02em]",
				className,
			)}
			{...rest}
		>
			<img
				src={markUrl}
				alt=""
				aria-hidden="true"
				width={128}
				height={128}
				className="size-[1.2em] shrink-0"
				data-id="brand-mark"
			/>
			<span>
				<span className="text-primary">Local</span>man
			</span>
		</span>
	);
}
