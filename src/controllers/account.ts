import type { Request, Response } from "express";
import orders from "../account";

export const accountController = (req: Request, res: Response) => {
    if (req.query.category) {
        const price = req.query.category.toString();
        res.render("accountMenu.html", { orders, currentPrice: price });
    }
    else {
        res.render("accountMenu.html", { orders, currentPrice: null });
    }
};