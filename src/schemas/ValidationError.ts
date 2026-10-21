import z from "zod";

export default z.object({
    error: z.string(),
    issues: z.array(z.object({
        message: z.string(),
    })),
});
