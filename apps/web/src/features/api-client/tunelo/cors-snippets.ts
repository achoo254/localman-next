/**
 * Smallest CORS setup per dev server that lets this page call it
 * directly. Code, not prose: never translated.
 */
export const CORS_FRAMEWORKS = [
	"express",
	"vite",
	"next",
	"spring",
	"laravel",
] as const;
export type CorsFramework = (typeof CORS_FRAMEWORKS)[number];

export const CORS_FRAMEWORK_LABELS: Readonly<Record<CorsFramework, string>> = {
	express: "Express",
	vite: "Vite",
	next: "Next.js",
	spring: "Spring",
	laravel: "Laravel",
};

export function corsSnippet(framework: CorsFramework, origin: string): string {
	switch (framework) {
		case "express":
			return `import cors from "cors";\n\napp.use(cors({ origin: "${origin}" }));`;
		case "vite":
			return `// vite.config.ts\nexport default defineConfig({\n  server: { cors: { origin: "${origin}" } },\n});`;
		case "next":
			return `// next.config.js\nmodule.exports = {\n  async headers() {\n    return [{\n      source: "/api/:path*",\n      headers: [\n        { key: "Access-Control-Allow-Origin", value: "${origin}" },\n        { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },\n        { key: "Access-Control-Allow-Headers", value: "*" },\n      ],\n    }];\n  },\n};`;
		case "spring":
			return `@Configuration\npublic class CorsConfig implements WebMvcConfigurer {\n  @Override\n  public void addCorsMappings(CorsRegistry registry) {\n    registry.addMapping("/**").allowedOrigins("${origin}").allowedMethods("*");\n  }\n}`;
		case "laravel":
			return `// config/cors.php\n'paths' => ['api/*'],\n'allowed_origins' => ['${origin}'],\n'allowed_methods' => ['*'],\n'allowed_headers' => ['*'],`;
	}
}
