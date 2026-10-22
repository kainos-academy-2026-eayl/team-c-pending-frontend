import type { Request, Response } from "express";
import { Router } from "express";
import z from "zod";
import Error from "../schemas/Error";
import ValidationError from "../schemas/ValidationError";

const router = Router();

router.get("/", (req: Request, res: Response) => {
    const error = req.query.error as string | undefined;
    res.render("register.njk", { error });
});

router.post("/", async (req: Request, res: Response) => {
    const { email, password, "first-name": firstName, "last-name": lastName, "confirm-password": confirmPassword } = req.body;
    if (password !== confirmPassword) {
        return res.redirect("/register?error=" + encodeURIComponent("Passwords do not match"));
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
            const data = Error.parse(await response.json());
            return res.redirect("/register?error=" + encodeURIComponent(data.error));
        } else if (response.status === 400) {
            const data = ValidationError.parse(await response.json());
            return res.redirect("/register?error=" + encodeURIComponent(data.issues[0]!.message));
        }
        console.log(response.status, await response.text());
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
