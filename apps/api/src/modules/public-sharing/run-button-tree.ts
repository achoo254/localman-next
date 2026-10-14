/**
 * Scripts of a collection a Run button imports. They run in the importer's
 * browser with their environment, so the page lists where they are and a
 * public button leaves them out unless the importer opts in.
 */
import type {
	CollectionTree,
	ImportedItem,
	RequestScripts,
	ScriptLocation,
} from "@localman/shared/api-client";

const NO_SCRIPTS: RequestScripts = { pre: "", post: "" };

function locationsOf(
	scripts: RequestScripts,
	path: string[],
): ScriptLocation[] {
	const found: ScriptLocation[] = [];
	if (scripts.pre.trim() !== "") found.push({ path, phase: "pre" });
	if (scripts.post.trim() !== "") found.push({ path, phase: "post" });
	return found;
}

function itemLocations(
	items: readonly ImportedItem[],
	path: string[],
): ScriptLocation[] {
	return items.flatMap((item) => {
		const here = [...path, item.name];
		return item.kind === "folder"
			? [...locationsOf(item.scripts, here), ...itemLocations(item.items, here)]
			: locationsOf(item.draft.scripts, here);
	});
}

export function scriptLocations(tree: CollectionTree): ScriptLocation[] {
	return [...locationsOf(tree.scripts, []), ...itemLocations(tree.items, [])];
}

function itemWithoutScripts(item: ImportedItem): ImportedItem {
	if (item.kind === "folder") {
		return {
			...item,
			scripts: NO_SCRIPTS,
			items: item.items.map(itemWithoutScripts),
		};
	}
	return {
		...item,
		draft: { ...item.draft, scripts: NO_SCRIPTS },
		examples: item.examples.map((example) => ({
			...example,
			request: { ...example.request, scripts: NO_SCRIPTS },
		})),
	};
}

export function withoutScripts(tree: CollectionTree): CollectionTree {
	return {
		...tree,
		scripts: NO_SCRIPTS,
		items: tree.items.map(itemWithoutScripts),
	};
}
