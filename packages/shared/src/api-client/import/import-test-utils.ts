/** Helpers shared by the import and export tests. */
import { readFileSync } from "node:fs";
import { importText } from "./import-text.js";
import type {
	CollectionTree,
	ImportedCollection,
} from "./imported-collection.js";

/** Text of a file in `import/__fixtures__/`. */
export function readFixture(name: string): string {
	return readFileSync(
		new URL(`./__fixtures__/${name}`, import.meta.url),
		"utf8",
	);
}

/** Imports `text`, failing the test unless it is a collection. */
export function importCollection(text: string): ImportedCollection {
	const result = importText(text);
	if (!result.ok) throw new Error(`import failed: ${result.error.code}`);
	if (result.value.format === "environment-v21") {
		throw new Error("expected a collection, got an environment");
	}
	return result.value;
}

/** The value with every `id` key removed (ids are fresh on each import). */
export function withoutIds(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(withoutIds);
	if (value === null || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value)
			.filter(([key]) => key !== "id")
			.map(([key, item]) => [key, withoutIds(item)]),
	);
}

/** The tree as an export brings it back: secret variable values empty. */
export function withBlankSecrets<T extends CollectionTree>(tree: T): T {
	const variables = tree.variables.map((variable) =>
		variable.secret ? { ...variable, value: "" } : variable,
	);
	return { ...tree, variables };
}
