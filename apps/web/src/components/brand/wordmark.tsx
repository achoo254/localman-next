import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

export type WordmarkProps = Omit<ComponentProps<"span">, "children">;

/** The Localman logotype in bold JetBrains Mono; "Local" uses violet step 11. */
export function Wordmark({ className, ...rest }: WordmarkProps) {
	return (
		<span
			className={cn(
				"font-bold font-mono text-fg text-xl tracking-[-0.02em]",
				className,
			)}
			{...rest}
		>
			<span className="text-primary">Local</span>man
		</span>
	);
}
