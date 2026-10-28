import type { Request, Response } from "express";
import orders from "../orders";
import z from "zod";

export const accountController = async (req: Request, res: Response) => {
    const jwt = req.cookies.JWT_TOKEN as string | undefined;
    if (jwt) {
        //get name 
        const name = await fetch(`${process.env.API_ADDRESS}/me`, {
            headers: {
                "Authorization": `Bearer ${jwt}`
            }
        });
        if (name.status === 401 || name.status === 403) {
            res.clearCookie("JWT_TOKEN");
            return res.redirect("/login");
        }
        if (!name.ok) {
            return res.status(name.status).send("Failed to load account");
        }
        const data = await name.json();
        const Me = z.object({
            firstName: z.string(),
            lastName: z.string()
        });
        const user = Me.parse(data);
        res.render("accountMenu.njk", { orders, firstName: user.firstName, lastName: user.lastName });
    } else {
        res.redirect("/login");
    }



    // get email
    if (jwt) {
        const email = await fetch('${process.env.API_ADDRESS}/me',
            {
                headers: {
                    "Authorization": `Bearer ${jwt}`
                }
            });
        if (email.status === 401 || email.status === 403) {
            res.clearCookie("JWT_TOKEN");
            return res.redirect("/login");
        }
        if (!email.ok) {
            return res.status(email.status).send("Failed to load account");
        }
        const data = await email.json();
        const Me = z.object(
            {
                Email: z.string(),
            });
        const user = Me.parse(data);
        res.render("accountMenu.njk", { orders, email: user.Email });
    }
    else {
        res.redirect("/login");
    }


    // get customerID
    if (jwt) {
        const customerID = await fetch('${process.env.API_ADDRESS}/me',
            {
                headers: {
                    "Authorization": `Bearer ${jwt}`
                }
            });
        if (customerID.status === 401 || customerID.status === 403) {
            res.clearCookie("JWT_TOKEN");
            return res.redirect("/login");
        }
        if (!customerID.ok) {
            return res.status(customerID.status).send("Failed to load account");
        }
        const data = await customerID.json();
        const Me = z.object(
            {
                customerID: z.string(),
            });
        const user = Me.parse(data);
        res.render("accountMenu.njk", { orders, customerID: user.customerID });
    }
    else {
        res.redirect("/login");
    }
};
