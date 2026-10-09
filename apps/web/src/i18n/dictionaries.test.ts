import { describe, expect, it } from "vitest";
import type { Messages } from "./message-types";
import { en } from "./messages/en/dictionary";
import { vi } from "./messages/vi/dictionary";
import { zhCN } from "./messages/zh-CN/dictionary";

type Leaf = { key: string; texts: string[]; plural: boolean };

/** Every leaf of a dictionary with its text (all forms for a plural). */
function leaves(node: unknown, prefix = ""): Leaf[] {
	if (typeof node === "string") {
		return [{ key: prefix, texts: [node], plural: false }];
	}
	if (typeof node !== "object" || node === null) return [];
	const record = node as Record<string, unknown>;
	if (typeof record.other === "string") {
		const texts = Object.values(record).filter(
			(value): value is string => typeof value === "string",
		);
		return [{ key: prefix, texts, plural: true }];
	}
	return Object.entries(record).flatMap(([key, value]) =>
		leaves(value, prefix ? `${prefix}.${key}` : key),
	);
}

/** Placeholders of a leaf, sorted: `{count}`, `{name}`… */
function placeholders(leaf: Leaf): string[] {
	const names = leaf.texts.flatMap((text) =>
		[...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? ""),
	);
	return [...new Set(names)].sort();
}

/** Tag names of a leaf: `<code>`, `<b>`. */
function tags(leaf: Leaf): string[] {
	const names = leaf.texts.flatMap((text) =>
		[...text.matchAll(/<(\w+)>/g)].map((match) => match[1] ?? ""),
	);
	return [...new Set(names)].sort();
}

const TRANSLATIONS: Array<[string, Messages]> = [
	["vi", vi],
	["zh-CN", zhCN],
];

describe.each(TRANSLATIONS)("%s dictionary", (_name, messages) => {
	const source = new Map(leaves(en).map((leaf) => [leaf.key, leaf]));
	const translated = leaves(messages);

	it("has exactly the English keys", () => {
		expect(translated.map((leaf) => leaf.key).sort()).toEqual(
			[...source.keys()].sort(),
		);
	});

	it("keeps every placeholder, tag and plural of the English text", () => {
		for (const leaf of translated) {
			const english = source.get(leaf.key);
			if (!english) continue;
			expect(placeholders(leaf), leaf.key).toEqual(placeholders(english));
			expect(tags(leaf), leaf.key).toEqual(tags(english));
			expect(leaf.plural, leaf.key).toBe(english.plural);
		}
	});

	it("leaves no text empty", () => {
		for (const leaf of translated) {
			for (const text of leaf.texts) expect(text.trim(), leaf.key).not.toBe("");
		}
	});
});
