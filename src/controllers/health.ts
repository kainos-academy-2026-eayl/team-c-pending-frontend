import type { Request, Response } from "express";

export const healthController = (_req: Request, res: Response) => {
    res.json({ status: "ok", uptime: process.uptime() });
};