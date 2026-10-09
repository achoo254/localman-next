/**
 * The 16 snippet targets and their generators, in a static map: importing
 * this module is enough, nothing registers itself as a side effect (the
 * web build treats `packages/shared` as side-effect free and would drop
 * such imports). Labels are not here: the web app translates the target id.
 */
import { decodeUtf8OrNull } from "../byte-encoding.js";
import { HTTP_METHODS } from "../request-model.js";
import type { PreparedRequest } from "../request-preparer.js";
import { generateCsharpHttpClient } from "./generator-csharp-httpclient.js";
import { generateCurl } from "./generator-curl.js";
import { generateDartHttp } from "./generator-dart-http.js";
import { generateGoNative } from "./generator-go-native.js";
import { generateHttpie } from "./generator-httpie.js";
import { generateJavaHttpUrlConnection } from "./generator-java-httpurlconnection.js";
import { generateJavaOkHttp } from "./generator-java-okhttp.js";
import { generateJavascriptAxios } from "./generator-javascript-axios.js";
import { generateJavascriptFetch } from "./generator-javascript-fetch.js";
import { generateKotlinOkHttp } from "./generator-kotlin-okhttp.js";
import { generatePhpCurl } from "./generator-php-curl.js";
import { generatePowershell } from "./generator-powershell.js";
import { generatePythonRequests } from "./generator-python-requests.js";
import { generateRubyNetHttp } from "./generator-ruby-net-http.js";
import { generateRustReqwest } from "./generator-rust-reqwest.js";
import { generateSwiftUrlSession } from "./generator-swift-urlsession.js";
import type { SnippetGenerator, SnippetRequest } from "./snippet-input.js";

export const SNIPPET_TARGETS = [
	"curl",
	"javascript-fetch",
	"javascript-axios",
	"python-requests",
	"go-native",
	"java-httpurlconnection",
	"java-okhttp",
	"php-curl",
	"csharp-httpclient",
	"ruby-net-http",
	"swift-urlsession",
	"kotlin-okhttp",
	"dart-http",
	"rust-reqwest",
	"powershell",
	"httpie",
] as const;
export type SnippetTarget = (typeof SNIPPET_TARGETS)[number];

/** Highlighting mode of the generated code. */
export type SnippetSyntax =
	| "shell"
	| "javascript"
	| "python"
	| "go"
	| "java"
	| "php"
	| "csharp"
	| "ruby"
	| "swift"
	| "kotlin"
	| "dart"
	| "rust"
	| "powershell";

const TARGETS: Readonly<
	Record<SnippetTarget, { generate: SnippetGenerator; syntax: SnippetSyntax }>
> = {
	curl: { generate: generateCurl, syntax: "shell" },
	"javascript-fetch": {
		generate: generateJavascriptFetch,
		syntax: "javascript",
	},
	"javascript-axios": {
		generate: generateJavascriptAxios,
		syntax: "javascript",
	},
	"python-requests": { generate: generatePythonRequests, syntax: "python" },
	"go-native": { generate: generateGoNative, syntax: "go" },
	"java-httpurlconnection": {
		generate: generateJavaHttpUrlConnection,
		syntax: "java",
	},
	"java-okhttp": { generate: generateJavaOkHttp, syntax: "java" },
	"php-curl": { generate: generatePhpCurl, syntax: "php" },
	"csharp-httpclient": { generate: generateCsharpHttpClient, syntax: "csharp" },
	"ruby-net-http": { generate: generateRubyNetHttp, syntax: "ruby" },
	"swift-urlsession": { generate: generateSwiftUrlSession, syntax: "swift" },
	"kotlin-okhttp": { generate: generateKotlinOkHttp, syntax: "kotlin" },
	"dart-http": { generate: generateDartHttp, syntax: "dart" },
	"rust-reqwest": { generate: generateRustReqwest, syntax: "rust" },
	powershell: { generate: generatePowershell, syntax: "powershell" },
	httpie: { generate: generateHttpie, syntax: "shell" },
};

export function isSnippetTarget(value: string): value is SnippetTarget {
	return SNIPPET_TARGETS.some((target) => target === value);
}

export function snippetSyntax(target: SnippetTarget): SnippetSyntax {
	return TARGETS[target].syntax;
}

export interface SnippetResult {
	code: string;
	/**
	 * The body is binary (a picked file, form-data with a file) and is not
	 * in the code; the UI says so next to the snippet.
	 */
	bodyOmitted: boolean;
}

/** The prepared request as generator input; bytes only if valid UTF-8. */
export function toSnippetRequest(prepared: PreparedRequest): {
	request: SnippetRequest;
	bodyOmitted: boolean;
} {
	const { method, url, headers, body } = prepared;
	// The type allows only the seven methods; a cast value must not reach
	// generated code (it is printed unquoted in some languages).
	if (!HTTP_METHODS.includes(method))
		throw new RangeError("Unsupported method");
	const text =
		body.kind === "none"
			? null
			: body.kind === "text"
				? body.text
				: decodeUtf8OrNull(body.bytes);
	return {
		request: { method, url, headers, body: text },
		bodyOmitted: body.kind === "bytes" && text === null,
	};
}

/** Code for `target`; throws `RangeError` for an unknown target or method. */
export function generateSnippet(
	target: SnippetTarget,
	prepared: PreparedRequest,
): SnippetResult {
	if (!isSnippetTarget(target)) throw new RangeError("Unknown snippet target");
	const { request, bodyOmitted } = toSnippetRequest(prepared);
	return { code: TARGETS[target].generate(request), bodyOmitted };
}
