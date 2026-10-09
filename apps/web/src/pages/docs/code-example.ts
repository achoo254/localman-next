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
	/**
	 * Section anchor (`/docs/code-examples#pagination`), also the key of
	 * its title under `docs.codeExamples.titles`.
	 */
	readonly id: "crud" | "nested" | "pagination" | "errors";
	readonly code: Readonly<Record<ExampleLanguage, string>>;
}
