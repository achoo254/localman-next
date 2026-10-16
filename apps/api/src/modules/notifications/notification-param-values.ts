import { z } from "zod";

/** Values stored in notification params, shared by every event's schema. */

/** A name shown inside a sentence (project, person). */
export const name = z.string().trim().min(1).max(200);
/** A calendar day in Asia/Saigon, `YYYY-MM-DD`. */
export const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
