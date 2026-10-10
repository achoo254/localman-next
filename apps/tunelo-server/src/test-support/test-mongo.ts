import mongoose from "mongoose";
import { afterAll, beforeAll, inject } from "vitest";

/** Connects mongoose to a database of its own for the calling test file. */
export function useTestDatabase(name: string): void {
	beforeAll(async () => {
		const uri = new URL(inject("mongoUri"));
		uri.pathname = `/${name}`;
		await mongoose.connect(uri.toString());
		await mongoose.connection.dropDatabase();
	});
	afterAll(async () => {
		await mongoose.connection.dropDatabase();
		await mongoose.disconnect();
	});
}
