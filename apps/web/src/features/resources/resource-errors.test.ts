import { describe, expect, it } from "vitest";
import { ApiError } from "../../lib/api-client";
import { localizedError, resourceErrorMessage } from "./resource-errors";

const error = (status: number, code: string, details?: unknown) =>
	new ApiError(status, code, `${code} in English`, details);

describe("resourceErrorMessage", () => {
	it.each([
		[409, "PARENT_HAS_NO_DATA", "Cần sinh dữ liệu cho resource cha trước."],
		[409, "RESOURCE_NAME_TAKEN", "Đã có resource cùng tên ở vị trí này."],
		[
			409,
			"TREE_CYCLE",
			"Không thể lồng resource vào chính nó hoặc vào resource con của nó.",
		],
		[409, "TREE_TOO_DEEP", "Cây resource chỉ lồng được tối đa 10 cấp."],
		[
			404,
			"NOT_FOUND",
			"Resource hoặc project không còn tồn tại. Tải lại trang để cập nhật.",
		],
		[
			403,
			"PLAN_LIMIT_REACHED",
			"Bạn đã dùng hết số resource gói hiện tại cho phép.",
		],
		[403, "FORBIDDEN", "Bạn chỉ có quyền xem project này."],
		[400, "VALIDATION_ERROR", "Dữ liệu gửi lên không hợp lệ."],
		[
			413,
			"PAYLOAD_TOO_LARGE",
			"Dữ liệu gửi lên quá lớn (tối đa 2 MB mỗi resource).",
		],
	])("maps %i %s", (status, code, message) => {
		expect(resourceErrorMessage(error(status, code))).toBe(message);
	});

	it("names the field of a validation error and the resource of a size error", () => {
		expect(
			resourceErrorMessage(
				error(400, "VALIDATION_ERROR", [
					{ path: "schema.0.name", message: "x" },
				]),
			),
		).toBe(
			"Dữ liệu không hợp lệ ở “schema.0.name”: VALIDATION_ERROR in English",
		);
		expect(
			resourceErrorMessage(
				error(413, "DATA_TOO_LARGE", { limit: "resource", name: "posts" }),
			),
		).toBe(
			"Dữ liệu của posts vượt 2 MB. Hãy giảm số bản ghi hoặc kích thước mỗi bản ghi.",
		);
		expect(resourceErrorMessage(error(409, "FIELD_CONFLICT"))).toMatch(
			/userId/,
		);
		expect(resourceErrorMessage(error(400, "TEMPLATE_TOO_LARGE"))).toMatch(
			/32 KB/,
		);
	});

	it("falls back to the API message, and keeps the code when localizing", () => {
		expect(resourceErrorMessage(error(409, "CONFLICT"))).toBe(
			"CONFLICT in English",
		);
		const localized = localizedError(error(409, "TREE_CYCLE"));
		expect(localized).toBeInstanceOf(ApiError);
		expect(localized).toMatchObject({ code: "TREE_CYCLE", status: 409 });
		expect((localized as ApiError).message).toMatch(/^Không thể lồng/);
	});
});
