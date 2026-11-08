/** Sources of `@tunelo/shared` this package carries a copy of. */
export const SHARED_FILES = [
	"protocol.ts",
	"constants.ts",
	"http-headers.ts",
] as const;

/** First line of every copy, naming the original to edit instead. */
export function copyHeader(name: string): string {
	return `// Copy of packages/tunelo-shared/src/${name}: edit the original, then run \`pnpm --filter @tunelo/client sync:shared\`.\n`;
}
