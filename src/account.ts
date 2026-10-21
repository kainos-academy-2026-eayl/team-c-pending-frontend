const orders = [
    {
        orderID: 1,
        price: 10.99,
        items: 3,
    }
];
export const filterOrdersByPrice = (price: number) => {
    return orders.filter(order => order.price <= price);
};
export default orders;