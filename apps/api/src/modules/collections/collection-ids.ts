import { Types } from "mongoose";

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** The ObjectId of a 24-hex-digit id, `null` for anything else. */
export function toObjectId(id: string): Types.ObjectId | null {
	return OBJECT_ID.test(id) ? new Types.ObjectId(id) : null;
}
