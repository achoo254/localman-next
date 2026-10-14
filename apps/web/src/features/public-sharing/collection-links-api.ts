/**
 * Public and guest links of a collection (Share dialog), and the
 * redacted collection they open (public page, guest page).
 */
import {
	COLLECTION_LINK_KINDS,
	type CollectionLinkKind,
	type PublicCollectionView,
	type SecretLikeValue,
} from "@localman/shared/api-client";
import { apiRequest, withDryRun } from "../../lib/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
	expectBoolean,
	expectRecord,
	expectString,
} from "../../lib/json-guards";
import {
	nullableRecord,
	parsePublicView,
	parseWarnings,
} from "./public-sharing-parsers";

export interface CollectionLink {
	kind: CollectionLinkKind;
	/** Absolute URL of the page to hand out. */
	url: string;
	createdBy: string;
	createdAt: string;
}

export interface EnableLinkResult {
	dryRun: boolean;
	link: CollectionLink | null;
	warnings: SecretLikeValue[];
}

/** The guest page: the redacted view plus what the caller may do next. */
export interface GuestCollectionView extends PublicCollectionView {
	collectionId: string;
	canRequestAccess: boolean;
	alreadyHasAccess: boolean;
}

const SEGMENT: Record<CollectionLinkKind, string> = {
	public: "public-link",
	guest: "guest-link",
};

const linkPath = (collectionId: string, kind: CollectionLinkKind) =>
	`/api/v1/collections/${encodeURIComponent(collectionId)}/${SEGMENT[kind]}`;

function parseLink(data: JsonRecord | null): CollectionLink | null {
	if (!data) return null;
	const kind = COLLECTION_LINK_KINDS.find((k) => k === data.kind);
	if (!kind) throw new InvalidResponseError("link kind");
	return {
		kind,
		url: expectString(data, "url"),
		createdBy: expectString(data, "createdBy"),
		createdAt: expectString(data, "createdAt"),
	};
}

export async function fetchCollectionLink(
	collectionId: string,
	kind: CollectionLinkKind,
): Promise<CollectionLink | null> {
	const data = expectRecord(
		await apiRequest(linkPath(collectionId, kind)),
		"link",
	);
	return parseLink(nullableRecord(data, "link"));
}

/** With `dryRun`, only the warnings: nothing is published. */
export async function enableCollectionLink(
	collectionId: string,
	kind: CollectionLinkKind,
	dryRun: boolean,
): Promise<EnableLinkResult> {
	const data = expectRecord(
		await apiRequest(withDryRun(linkPath(collectionId, kind), dryRun), {
			method: "POST",
		}),
		"link",
	);
	return {
		dryRun: expectBoolean(data, "dryRun"),
		link: parseLink(nullableRecord(data, "link")),
		warnings: parseWarnings(data),
	};
}

export async function disableCollectionLink(
	collectionId: string,
	kind: CollectionLinkKind,
): Promise<void> {
	await apiRequest(linkPath(collectionId, kind), { method: "DELETE" });
}

/** Anonymous read: never sends the visitor to sign in. */
export async function fetchPublicCollection(
	linkId: string,
): Promise<PublicCollectionView> {
	return parsePublicView(
		await apiRequest(`/api/v1/public/links/${encodeURIComponent(linkId)}`, {
			redirectOnUnauthorized: false,
		}),
	);
}

/** Signed-in read of a guest link; opening it grants nothing. */
export async function fetchGuestCollection(
	linkId: string,
): Promise<GuestCollectionView> {
	const value = await apiRequest("/api/v1/guest-links/view", {
		method: "POST",
		body: { linkId },
	});
	const data = expectRecord(value, "guest collection");
	return {
		...parsePublicView(data),
		collectionId: expectString(data, "collectionId"),
		canRequestAccess: expectBoolean(data, "canRequestAccess"),
		alreadyHasAccess: expectBoolean(data, "alreadyHasAccess"),
	};
}
