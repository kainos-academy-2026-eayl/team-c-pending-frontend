import type { Request, Response } from "express";
import Order from "../schemas/order.schema";
import z from "zod";

export const accountController = async (req: Request, res: Response) => {
    const jwt = req.cookies.JWT_TOKEN as string | undefined;
    if (jwt) {
        const user = res.locals.me;

        const response = await fetch(`${process.env.API_ADDRESS}/orders`, { headers: { "Authorization": `Bearer ${jwt}` } });

        const orders = z.array(Order).parse(await response.json());

        res.render("accountMenu.njk",
            { orders, firstName: user.firstName, lastName: user.lastName, email: user.email, customerId: user.customerId }
        );
    } else {
        res.redirect("/login");
    }
};
