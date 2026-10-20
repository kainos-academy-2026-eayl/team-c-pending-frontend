import type { Request, Response } from "express";

export const loginController = (_req: Request, res: Response) => {
    res.render("login.html");
};