import {
	Client,
	type OAuthClientMetadata,
	type OAuthClientProvider,
	type OAuthDiscoveryState,
	type StoredOAuthClientInformation,
	type StoredOAuthTokens,
	StreamableHTTPClientTransport,
	UnauthorizedError,
} from "@modelcontextprotocol/client";

/**
 * TEST ONLY. An MCP client's OAuth state kept in memory, like Claude
 * Code's: dynamic registration at the IdP, PKCE verifier, tokens, and the
 * authorization URL it would open in the user's browser.
 */
export class InMemoryOAuthProvider implements OAuthClientProvider {
	authorizationUrl: URL | undefined;
	private information: StoredOAuthClientInformation | undefined;
	private saved: StoredOAuthTokens | undefined;
	private verifier = "";
	private discovery: OAuthDiscoveryState | undefined;

	constructor(readonly redirectUrl: string) {}

	get clientMetadata(): OAuthClientMetadata {
		return {
			client_name: "Localman MCP test agent",
			redirect_uris: [this.redirectUrl],
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			token_endpoint_auth_method: "none",
		};
	}

	clientInformation(): StoredOAuthClientInformation | undefined {
		return this.information;
	}

	/** Scopes the IdP registered the client with (its DCR answer). */
	registeredScopes(): string[] {
		const info = this.information;
		const scope = info && "scope" in info ? info.scope : undefined;
		return typeof scope === "string" ? scope.split(" ") : [];
	}

	saveClientInformation(information: StoredOAuthClientInformation): void {
		this.information = information;
	}

	tokens(): StoredOAuthTokens | undefined {
		return this.saved;
	}

	saveTokens(tokens: StoredOAuthTokens): void {
		this.saved = tokens;
	}

	redirectToAuthorization(authorizationUrl: URL): void {
		this.authorizationUrl = authorizationUrl;
	}

	saveCodeVerifier(codeVerifier: string): void {
		this.verifier = codeVerifier;
	}

	codeVerifier(): string {
		return this.verifier;
	}

	/** Lets the SDK check the callback comes from the IdP it discovered. */
	saveDiscoveryState(state: OAuthDiscoveryState): void {
		this.discovery = state;
	}

	discoveryState(): OAuthDiscoveryState | undefined {
		return this.discovery;
	}
}

function newClient(): Client {
	return new Client({ name: "localman-oauth-test", version: "0.0.0" });
}

/**
 * Runs the MCP authorization flow against `mcpUrl` the way an agent does:
 * the first connection gets 401, the SDK discovers the protected resource
 * metadata and the IdP, registers the client (DCR) and builds the
 * authorization URL with PKCE and `resource`; `authorize` plays the user's
 * browser and returns the callback URL; the code is exchanged and a new
 * connection is opened with the access token.
 */
export async function connectWithOAuth(
	mcpUrl: string,
	provider: InMemoryOAuthProvider,
	authorize: (authorizationUrl: URL) => Promise<URL>,
): Promise<Client> {
	const first = new StreamableHTTPClientTransport(new URL(mcpUrl), {
		authProvider: provider,
	});
	try {
		await newClient().connect(first);
		throw new Error("Expected the first connection to need authorization");
	} catch (error) {
		if (!(error instanceof UnauthorizedError)) throw error;
	}
	const authorizationUrl = provider.authorizationUrl;
	if (!authorizationUrl) throw new Error("No authorization URL");
	const callback = await authorize(authorizationUrl);
	await first.finishAuth(callback.searchParams);
	const client = newClient();
	await client.connect(
		new StreamableHTTPClientTransport(new URL(mcpUrl), {
			authProvider: provider,
		}),
	);
	return client;
}
