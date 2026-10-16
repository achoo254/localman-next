import { COMMENT_BODY_MAX } from "@localman/shared/api-client";
import { z } from "zod";
import {
	COLLECTION_PATH,
	collectionIdSchema,
} from "../collections/collection-read-operations.js";

/** Paths and inputs the comment operations share. */
export const COMMENTS_PATH = `${COLLECTION_PATH}/comments`;
export const COMMENT_PATH = `${COMMENTS_PATH}/:commentId`;
export const idSchema = z.string().min(1).max(64);
export const bodySchema = z.string().trim().min(1).max(COMMENT_BODY_MAX);
export const commentInput = z.object({
	collectionId: collectionIdSchema,
	commentId: idSchema,
});
