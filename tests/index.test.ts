import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

describe("GET /health", () => {
	it("returns 200 and health status", async () => {
		const response = await request(createApp()).get("/health").expect(200);

		expect(response.body).toHaveProperty("status", "ok");
	});
});

describe("CSRF protection", () => {
	it("rejects state-changing requests without a same-origin Origin header", async () => {
		await request(createApp())
			.post("/logout")
			.set("Origin", "https://attacker.example")
			.expect(403);
	});
});
