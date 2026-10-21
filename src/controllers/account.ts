import type { Request, Response } from "express";
import orders from "../account";

export const accountController = (req: Request, res: Response) => {

    res.render("accountMenu.html", { orders });
};