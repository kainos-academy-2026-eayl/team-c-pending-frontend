import type { Request, Response } from "express";

export const registerController = (_req: Request, res: Response) => {
    res.render("register.njk");
};
