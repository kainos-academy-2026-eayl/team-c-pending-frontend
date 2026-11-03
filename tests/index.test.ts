import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import User from "../src/schemas/user.schema";

describe("User role parsing", () => {
	it("normalizes admin roles regardless of capitalization", () => {
		const user = User.parse({
			firstName: "Ada",
			lastName: "Lovelace",
			customerId: 1,
			email: "ada@example.com",
			role: "Admin",
			basketCount: 0,
		});

		expect(user.role).toBe("admin");
	});
});

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
