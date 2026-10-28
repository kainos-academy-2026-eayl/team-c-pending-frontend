import z from "zod";

export default z.object({
    firstName: z.string(),
    lastName: z.string(),
    customerId: z.number(),
    email: z.string(),
    basketCount: z.int(),
});
