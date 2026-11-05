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

	describe("GET /confirmation", () => {
		it("renders the confirmation page using the Express response", async () => {
			const response = await request(createApp())
				.get("/confirmation")
				.expect(200);

			expect(response.text).toContain("Your order is confirmed");
		});
	});
});

describe("Unmatched routes", () => {
	it.each(["get", "post"] as const)(
		"returns 404 for an unknown %s route",
		async (method) => {
			await request(createApp())
				[method]("/unknown")
				.set("Host", "localhost")
				.set("Origin", "http://localhost")
				.expect(404);
		},
	);
});

describe("CSRF protection", () => {
	it("rejects state-changing requests without a same-origin Origin header", async () => {
		await request(createApp())
			.post("/logout")
			.set("Origin", "https://attacker.example")
			.expect(403);
	});
});

describe("Password visibility without client-side JavaScript", () => {
	it("shows and hides the login password using the rendered button actions", async () => {
		const app = createApp();
		const initial = await request(app).get("/login").expect(200);
		expect(initial.text).toContain('value="show"');

		for (const [action, inputType, nextAction, label, pressed] of [
			["show", "text", "hide", "Hide", "true"],
			["hide", "password", "show", "Show", "false"],
		]) {
			const response = await request(app)
				.post("/login")
				.set("Host", "example.test")
				.set("Origin", "http://example.test")
				.type("form")
				.send({
					email: "person@example.test",
					password: "secret",
					passwordVisibility: action,
				})
				.expect(200);

			expect(response.headers["cache-control"]).toContain("no-store");
			expect(response.text).toMatch(
				new RegExp(
					`type="${inputType}"[^>]*name="password"[^>]*value="secret"`,
				),
			);
			expect(response.text).toMatch(
				new RegExp(
					`value="${nextAction}"[^>]*aria-pressed="${pressed}">${label}</button>`,
				),
			);
			expect(response.text).toContain('value="person@example.test"');
			expect(response.text).not.toContain("<script");
		}
	});

	it("shows and hides the registration password using the rendered button actions", async () => {
		const app = createApp();
		const initial = await request(app).get("/register").expect(200);
		expect(initial.text).toContain('value="show-password"');

		for (const [action, inputType, nextAction, label] of [
			["show-password", "text", "hide-password", "Hide"],
			["hide-password", "password", "show-password", "Show"],
		]) {
			const response = await request(app)
				.post("/register")
				.set("Host", "example.test")
				.set("Origin", "http://example.test")
				.type("form")
				.send({
					email: "person@example.test",
					password: "secret",
					"confirm-password": "different",
					passwordVisibility: action,
				})
				.expect(200);

			expect(response.text).toMatch(
				new RegExp(
					`type="${inputType}"[^>]*name="password"[^>]*value="secret"`,
				),
			);
			expect(response.text).toMatch(
				new RegExp(`value="${nextAction}"[^>]*>${label}</button>`),
			);
			expect(response.headers["cache-control"]).toContain("no-store");
			expect(response.text).not.toContain("<script");
		}
	});

	it("shows only the requested registration password field", async () => {
		const response = await request(createApp())
			.post("/register")
			.set("Host", "example.test")
			.set("Origin", "http://example.test")
			.type("form")
			.send({
				"first-name": "Pat",
				"last-name": "Example",
				email: "person@example.test",
				password: "secret",
				"confirm-password": "secret-confirm",
				passwordVisibility: "show-confirm-password",
			})
			.expect(200);

		expect(response.headers["cache-control"]).toContain("no-store");
		expect(response.text).toMatch(
			/type="password"[^>]*name="password"[^>]*value="secret"/,
		);
		expect(response.text).toMatch(
			/type="text"[^>]*name="confirm-password"[^>]*value="secret-confirm"/,
		);
		expect(response.text).toContain('value="hide-confirm-password"');
		expect(response.text).not.toContain("<script");
	});
});
