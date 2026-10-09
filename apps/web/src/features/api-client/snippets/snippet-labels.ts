import type { SnippetTarget } from "@localman/shared/api-client";

/**
 * Names of the snippet targets. Product and library names, the same in
 * every language, so they are not in the dictionaries.
 */
export const SNIPPET_LABELS: Readonly<Record<SnippetTarget, string>> = {
	curl: "cURL",
	"javascript-fetch": "JavaScript - fetch",
	"javascript-axios": "JavaScript - Axios",
	"python-requests": "Python - requests",
	"go-native": "Go - net/http",
	"java-httpurlconnection": "Java - HttpURLConnection",
	"java-okhttp": "Java - OkHttp",
	"php-curl": "PHP - cURL",
	"csharp-httpclient": "C# - HttpClient",
	"ruby-net-http": "Ruby - Net::HTTP",
	"swift-urlsession": "Swift - URLSession",
	"kotlin-okhttp": "Kotlin - OkHttp",
	"dart-http": "Dart - http",
	"rust-reqwest": "Rust - reqwest",
	powershell: "PowerShell",
	httpie: "HTTPie",
};
