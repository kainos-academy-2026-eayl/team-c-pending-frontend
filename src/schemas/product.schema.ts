import z from "zod";

const Product = z.object({
    name: z.string(),
    productID: z.number(),
    price: z.number(),
    description: z.string(),
    category: z.string(),
    quantity: z.int(),
    image: z.string().nullable(),
});

export const ProductWithReviews = Product.extend({
    reviews: z.array(z.object({
        rating: z.number(),
        comment: z.string().optional(),
        customer: z.object({
            customerID: z.number(),
            firstName: z.string(),
            lastName: z.string()
        })
    }))
});

export default Product;
