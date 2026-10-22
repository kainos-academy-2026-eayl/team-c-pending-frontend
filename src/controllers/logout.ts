import type { Request, Response } from "express";

export const logoutController = (_req: Request, res: Response) => {
    res.clearCookie("JWT_TOKEN");
    res.redirect("/login");
};
