import { useEffect, useRef, useState } from "react";
import { Badge, type BadgeTone } from "../../components/ui/badge";
import { cn } from "../../lib/cn";
import type { EndpointGroup, EndpointMethod } from "./relations-endpoints";

const METHOD_TONE: Record<EndpointMethod, BadgeTone> = {
	GET: "success",
	POST: "info",
	PUT: "warning",
	DELETE: "danger",
};

/** How long a path that just appeared keeps its tint, in ms. */
const FRESH_MS = 1200;

function pathsOf(groups: readonly EndpointGroup[]): Set<string> {
	return new Set(groups.flatMap((group) => group.lines.map((l) => l.path)));
}

/**
 * Paths not in the previous render, tinted for a moment so the reader sees
 * what the last nesting added. Nothing is tinted on first render.
 */
function useFreshPaths(groups: readonly EndpointGroup[]): ReadonlySet<string> {
	const previous = useRef<Set<string> | null>(null);
	const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
	useEffect(() => {
		const current = pathsOf(groups);
		const before = previous.current;
		previous.current = current;
		if (before === null) return;
		const added = [...current].filter((path) => !before.has(path));
		if (added.length === 0) return;
		setFresh(new Set(added));
		const timer = window.setTimeout(() => setFresh(new Set()), FRESH_MS);
		return () => window.clearTimeout(timer);
	}, [groups]);
	return fresh;
}

/** Endpoint groups of the demo tree, one per resource, in list order. */
export function GeneratedEndpointsList({
	groups,
}: {
	groups: readonly EndpointGroup[];
}) {
	const fresh = useFreshPaths(groups);
	return (
		<div className="grid gap-4">
			{groups.map((group) => (
				<div
					key={group.name}
					data-id={`landing-ep-${group.name}`}
					className="grid gap-1.5"
				>
					<h4 className="m-0 font-bold font-mono text-sm">{group.name}</h4>
					<ul className="m-0 grid list-none gap-1 p-0">
						{group.lines.map((line) => (
							<li
								key={line.path}
								data-fresh={fresh.has(line.path) ? "true" : undefined}
								className={cn(
									"flex flex-wrap items-center gap-1 rounded-sm px-1 py-0.5 motion-safe:transition-[background-color]",
									fresh.has(line.path) && "motion-safe:bg-primary/12",
								)}
							>
								{line.methods.map((method) => (
									<Badge key={method} tone={METHOD_TONE[method]}>
										{method}
									</Badge>
								))}
								<code className="break-all text-[0.8125rem]">{line.path}</code>
							</li>
						))}
					</ul>
				</div>
			))}
		</div>
	);
}
