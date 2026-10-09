import { MAX_RESOURCE_DEPTH } from "@localman/shared/constants";
import { ApiError, errorMessage } from "../../lib/api-client";
import { isRecord } from "../../lib/json-guards";

/** `details` of a 400 VALIDATION_ERROR: `[{ path, message }]`. */
function firstIssuePath(details: unknown): string | null {
	if (!Array.isArray(details)) return null;
	const [first] = details;
	return isRecord(first) && typeof first.path === "string" && first.path
		? first.path
		: null;
}

function detailString(details: unknown, key: string): string | null {
	if (!isRecord(details)) return null;
	const value = details[key];
	return typeof value === "string" ? value : null;
}

/** 413 DATA_TOO_LARGE names the resource and the cap that was passed. */
function dataTooLarge(details: unknown): string {
	const name = detailString(details, "name");
	const subject = name ? `Dữ liệu của ${name}` : "Dữ liệu";
	return detailString(details, "limit") === "record"
		? `${subject} có bản ghi vượt 32 KB. Hãy rút gọn bản ghi hoặc template.`
		: `${subject} vượt 2 MB. Hãy giảm số bản ghi hoặc kích thước mỗi bản ghi.`;
}

/**
 * Vietnamese sentence for an error of the resource API (the API answers
 * in English). Unknown codes fall back to the API's message.
 */
export function resourceErrorMessage(error: unknown): string {
	if (!(error instanceof ApiError)) return errorMessage(error);
	switch (error.code) {
		case "VALIDATION_ERROR": {
			const path = firstIssuePath(error.details);
			return path
				? `Dữ liệu không hợp lệ ở “${path}”: ${error.message}`
				: "Dữ liệu gửi lên không hợp lệ.";
		}
		case "TEMPLATE_TOO_LARGE":
			return "Object template có thể sinh bản ghi lớn hơn 32 KB. Hãy rút gọn template.";
		case "NOT_FOUND":
			return "Resource hoặc project không còn tồn tại. Tải lại trang để cập nhật.";
		case "PARENT_HAS_NO_DATA":
			return "Cần sinh dữ liệu cho resource cha trước.";
		case "RESOURCE_NAME_TAKEN":
			return "Đã có resource cùng tên ở vị trí này.";
		case "TREE_CYCLE":
			return "Không thể lồng resource vào chính nó hoặc vào resource con của nó.";
		case "TREE_TOO_DEEP":
			return `Cây resource chỉ lồng được tối đa ${MAX_RESOURCE_DEPTH} cấp.`;
		case "FIELD_CONFLICT":
			return "Thay đổi này làm một field trùng tên với field sinh tự động (ví dụ userId). Đổi tên hoặc xoá field đó trước.";
		case "PLAN_LIMIT_REACHED":
			return "Bạn đã dùng hết số resource gói hiện tại cho phép.";
		case "DATA_TOO_LARGE":
			return dataTooLarge(error.details);
		case "FORBIDDEN":
			return "Bạn chỉ có quyền xem project này.";
		default:
			if (error.status === 413) {
				return "Dữ liệu gửi lên quá lớn (tối đa 2 MB mỗi resource).";
			}
			return errorMessage(error);
	}
}

/**
 * The same error with the Vietnamese sentence as its message, for
 * components that display `errorMessage(error)` (ConfirmModal).
 */
export function localizedError(error: unknown): unknown {
	return error instanceof ApiError
		? new ApiError(
				error.status,
				error.code,
				resourceErrorMessage(error),
				error.details,
			)
		: error;
}

/** Awaits `promise`, rejecting with `localizedError` of its failure. */
export async function localized<T>(promise: Promise<T>): Promise<T> {
	try {
		return await promise;
	} catch (error) {
		throw localizedError(error);
	}
}
