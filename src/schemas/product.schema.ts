import z from "zod";

const Product = z.object({
    productID: z.number().int().positive().optional(),
    id: z.number().int().positive().optional(),
    name: z.string(),
    price: z.number(),
    description: z.string(),
    category: z.string(),
    quantity: z.number().int(),
    image: z.string().nullable(),
}).refine(
    (data) => data.productID !== undefined || data.id !== undefined,
    { message: "Either productID or id must be provided" }
).transform(({ productID, id, ...product }) => {
    const finalId = productID ?? id;
    if (!finalId) throw new Error("Either productID or id must be provided");
    return {
        ...product,
        id: finalId,
    };
});

export default Product;
