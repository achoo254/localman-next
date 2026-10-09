import type { IncomingMessage, ServerResponse } from "node:http";
import type Provider from "oidc-provider";

function stringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

/**
 * TEST ONLY. Stands in for the IdP's login and consent pages: signs
 * `accountId` in and grants every requested scope and claim.
 */
export async function autoCompleteInteraction(
	provider: Provider,
	accountId: string,
	req: IncomingMessage,
	res: ServerResponse,
): Promise<void> {
	const details = await provider.interactionDetails(req, res);
	const { prompt, params } = details;
	if (prompt.name === "login") {
		await provider.interactionFinished(
			req,
			res,
			{ login: { accountId } },
			{ mergeWithLastSubmission: false },
		);
		return;
	}
	if (prompt.name !== "consent" || typeof params.client_id !== "string") {
		res.statusCode = 400;
		res.end(`Unexpected prompt ${prompt.name}`);
		return;
	}
	const grant = details.grantId
		? await provider.Grant.find(details.grantId)
		: new provider.Grant({ accountId, clientId: params.client_id });
	if (!grant) throw new Error("Existing grant not found");
	const scopes = stringArray(prompt.details.missingOIDCScope);
	if (scopes.length > 0) grant.addOIDCScope(scopes.join(" "));
	const claims = stringArray(prompt.details.missingOIDCClaims);
	if (claims.length > 0) grant.addOIDCClaims(claims);
	await provider.interactionFinished(
		req,
		res,
		{ consent: { grantId: await grant.save() } },
		{ mergeWithLastSubmission: true },
	);
}
