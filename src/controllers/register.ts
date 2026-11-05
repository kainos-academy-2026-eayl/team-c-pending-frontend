import type { Request, Response } from "express";
import { Router } from "express";
import z from "zod";
import ErrorSchema from "../schemas/error.schema";
import ValidationError from "../schemas/validation-error.schema";

const router = Router();

router.get("/", (req: Request, res: Response) => {
	const error = req.query.error as string | undefined;
	res.render("register.njk", { error });
});

router.post("/", async (req: Request, res: Response) => {
	const {
		email,
		password,
		"first-name": firstName,
		"last-name": lastName,
		"confirm-password": confirmPassword,
		passwordVisibility,
	} = req.body;

	if (
		passwordVisibility === "show-password" ||
		passwordVisibility === "hide-password" ||
		passwordVisibility === "show-confirm-password" ||
		passwordVisibility === "hide-confirm-password"
	) {
		res.set("Cache-Control", "no-store");
		return res.render("register.njk", {
			email: typeof email === "string" ? email : "",
			firstName: typeof firstName === "string" ? firstName : "",
			lastName: typeof lastName === "string" ? lastName : "",
			password: typeof password === "string" ? password : "",
			confirmPassword:
				typeof confirmPassword === "string" ? confirmPassword : "",
			visiblePasswordField: passwordVisibility.startsWith("show-")
				? passwordVisibility.slice("show-".length)
				: null,
		});
	}

	if (password !== confirmPassword) {
		return res.redirect(
			"/register?error=" + encodeURIComponent("Passwords do not match"),
		);
	}
	const response = await fetch(`${process.env.API_ADDRESS}/register`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ email, password, firstName, lastName }),
	});

	if (!response.ok) {
		if (response.status === 401 || response.status === 409) {
			const data = ErrorSchema.parse(await response.json());
			return res.redirect("/register?error=" + encodeURIComponent(data.error));
		} else if (response.status === 400) {
			const data = ValidationError.parse(await response.json());
			return res.redirect(
				"/register?error=" + encodeURIComponent(data.issues[0]!.message),
			);
		}
		return res.status(response.status).send("Login failed");
	}

	const ResponseFormat = z.object({
		accessToken: z.string(),
	});

	const data = ResponseFormat.parse(await response.json());

	res.cookie("JWT_TOKEN", data.accessToken, { httpOnly: true });

	res.redirect("/");
});

export default router;
