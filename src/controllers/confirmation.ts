import type { Request, Response } from "express";

export const confirmationController = (req: Request, res: Response) => {
    res.render("confirmation.njk");
};
