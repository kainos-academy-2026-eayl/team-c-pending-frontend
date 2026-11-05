import z from "zod";

export default z.object({
	firstName: z.string(),
	lastName: z.string(),
	customerId: z.number(),
	email: z.string(),
	role: z.string().transform((role) => role.toLowerCase()),
	basketCount: z.int(),
});
