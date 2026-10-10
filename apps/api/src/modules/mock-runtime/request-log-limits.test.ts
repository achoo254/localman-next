import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { createLogger } from "../../logger.js";
import { LOG_BODY_LIMIT, type RequestLogInput } from "./request-log-entry.js";
import { RequestLogModel, type StoredRequestLog } from "./request-log-model.js";
import { RequestLogService } from "./request-log-service.js";
import { useMockTestKit } from "./testing/mock-test-kit.js";

useMockTestKit();

const BODY = Buffer.alloc(LOG_BODY_LIMIT, "a");

function input(projectId: Types.ObjectId, n = 0): RequestLogInput {
	return {
		projectId,
		ownerPlan: { plan: "free", planExpiresAt: null },
		redactHeaders: [],
		at: new Date(),
		method: "POST",
		path: `/users/${n}`,
		query: "",
		status: 201,
		ms: 3,
		source: "mock",
		request: { headers: [], body: { bytes: BODY, size: BODY.length } },
		response: { headers: [], body: { bytes: BODY, size: BODY.length } },
	};
}

describe("request log limits", () => {
	it("drops new lines past the byte cap while Mongo is slow, and warns once", async () => {
		let release: () => void = () => undefined;
		const stalled = new Promise<void>((resolve) => {
			release = resolve;
		});
		const written: StoredRequestLog[][] = [];
		const maxBytes = 1024 * 1024;
		const service = new RequestLogService({
			maxBufferedBytes: maxBytes,
			write: async (lines) => {
				written.push(lines);
				await stalled;
			},
		});
		const logger = createLogger("silent");
		const warn = vi.spyOn(logger, "warn");
		service.configure(logger);
		const projectId = new Types.ObjectId();
		const seen: string[] = [];
		service.subscribe(projectId.toHexString(), (line) => seen.push(line.path));

		for (let n = 0; n < 200; n++) {
			expect(service.record(input(projectId, n))).not.toBeNull();
			// Lines held (buffered and being written) never pass the cap.
			expect(service.heldBytes).toBeLessThanOrEqual(maxBytes);
		}
		// Live views still get every line.
		expect(seen).toHaveLength(200);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0]?.[1]).toBe("Request log lines dropped");

		release();
		await service.flush();
		const kept = written.flat().length;
		// About 128 KB a line: a few lines fit in 1 MB, the rest were dropped.
		expect(kept).toBeGreaterThan(0);
		expect(kept).toBeLessThan(10);
		expect(service.heldBytes).toBe(0);
		// Room again once the write is done.
		service.record(input(projectId, 200));
		expect(service.heldBytes).toBeGreaterThan(0);
	});

	it("keeps each project's newest lines up to the cap", async () => {
		const service = new RequestLogService({
			maxLinesPerProject: 5,
			trimEveryMs: 0,
		});
		const busy = new Types.ObjectId();
		const quiet = new Types.ObjectId();
		for (let n = 0; n < 12; n++) service.record(input(busy, n));
		for (let n = 0; n < 3; n++) service.record(input(quiet, n));
		await service.flush();

		const paths = async (projectId: Types.ObjectId) =>
			(
				await RequestLogModel.find({ projectId })
					.sort({ _id: 1 })
					.select("path")
					.lean<{ path: string }[]>()
			).map((line) => line.path);
		expect(await paths(busy)).toEqual([
			"/users/7",
			"/users/8",
			"/users/9",
			"/users/10",
			"/users/11",
		]);
		expect(await paths(quiet)).toHaveLength(3);
	});
});
