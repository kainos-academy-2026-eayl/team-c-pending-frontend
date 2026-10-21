import type { Request, Response } from "express";
import orders from "../account";
import z from "zod";

export const accountController = async (req: Request, res: Response) => {
    const jwt = req.cookies.JWT_TOKEN as string | undefined;
    if (jwt) {
        const name = await fetch(`${process.env.API_ADDRESS}/me`, {
            headers: {
                "Authorization": `Bearer ${jwt}`
            }
        });
        const data = await name.json();
        const Me = z.object({
            firstName: z.string(),
            lastName: z.string()
        });
        const user = Me.parse(data);
        res.render("accountMenu.html", { orders, firstName: user.firstName, lastName: user.lastName });
    } else {
        res.redirect("/login");
    }
};
