import type { Request, Response } from "express";
import { Router } from "express";
import z from "zod";
import Error from "../schemas/error.schema";
import ValidationError from "../schemas/validation-error.schema";
import User from "../schemas/user.schema";

const router = Router();

router.get("/", (req: Request, res: Response) => {
    const error = req.query.error as string | undefined;
    res.render("login.njk", { error });
});

router.post("/", async (req: Request, res: Response) => {
    const { email, password, passwordVisibility } = req.body;

    if (passwordVisibility === "show" || passwordVisibility === "hide") {
        res.set("Cache-Control", "no-store");
        return res.render("login.njk", {
            email: typeof email === "string" ? email : "",
            password: typeof password === "string" ? password : "",
            passwordVisible: passwordVisibility === "show",
        });
    }

    const response = await fetch(`${process.env.API_ADDRESS}/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        if (response.status === 401) {
            const data = Error.parse(await response.json());
            return res.redirect("/login?error=" + encodeURIComponent(data.error));
        } else if (response.status === 400) {
            const data = ValidationError.parse(await response.json());
            return res.redirect("/login?error=" + encodeURIComponent(data.issues[0]!.message));
        }
        return res.status(response.status).send("Login failed");
    }

    const ResponseFormat = z.object({
        accessToken: z.string(),
    });

    const data = ResponseFormat.parse(await response.json());

    const userResponse = await fetch(`${process.env.API_ADDRESS}/me`, {
        headers: {
            Authorization: `Bearer ${data.accessToken}`,
        },
    });
    if (!userResponse.ok) {
        return res.status(userResponse.status).send("Login failed");
    }

    const user = User.parse(await userResponse.json());
    res.cookie("JWT_TOKEN", data.accessToken, { httpOnly: true });

    res.redirect(user.role === "admin" ? "/admin" : "/");
});
export default router;
