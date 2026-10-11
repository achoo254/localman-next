import { matchRange } from "./tree-search";

/** `name` with the part matching the search marked. */
export function HighlightName({
	name,
	query,
}: { name: string; query: string }) {
	const range = matchRange(name, query);
	if (!range) return <>{name}</>;
	const [start, end] = range;
	return (
		<>
			{name.slice(0, start)}
			<mark className="rounded-xs bg-accent/20 text-fg">
				{name.slice(start, end)}
			</mark>
			{name.slice(end)}
		</>
	);
}
