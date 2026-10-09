/** Client libraries the code examples are written for. */
export type ExampleLanguage = "fetch" | "axios" | "curl";

export const EXAMPLE_LANGUAGES: readonly {
	readonly id: ExampleLanguage;
	readonly label: string;
}[] = [
	{ id: "fetch", label: "fetch" },
	{ id: "axios", label: "axios" },
	{ id: "curl", label: "curl" },
];

/** One task shown in every language. */
export interface CodeExample {
	/** Section anchor (`/docs/code-examples#pagination`). */
	readonly id: string;
	readonly title: string;
	readonly code: Readonly<Record<ExampleLanguage, string>>;
}
