import type { Request, Response } from "express";
import orders from "../orders";

export const accountController = async (req: Request, res: Response) => {
    const jwt = req.cookies.JWT_TOKEN as string | undefined;
    if (jwt) {
        const user = res.locals.me;
        res.render("accountMenu.njk", { orders, firstName: user.firstName, lastName: user.lastName, email: user.email, customerId: user.customerId });
    } else {
        res.redirect("/login");
    }
};
