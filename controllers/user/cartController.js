const Product = require("../../models/productModel")
const User = require("../../models/userModel")
const Cart = require("../../models/cartModel")

const loadCart = async (req, res) => {
    const userId = req.session.user_id
    try {
        const user = await User.findById(userId).populate({
            path: 'cart',
            populate: {
                path: 'items.product',
                model: 'Product'
            }
        })
        // console.log("user",user);

        if (!user || !user.cart || !user.cart.items) {
            return res.render('cart', { cart: [], total: 0, qty: 0 })
        }
        const cartData = user.cart.items
        console.log("cartD", cartData);


        const { total, qty, totalDiscountPrice } = cartData.reduce((acc, item) => {
            if (item.product) {
                // Use offerDiscountedPrice if available, otherwise use price
                const priceToUse = item.product.price;
                const subtotal = priceToUse * item.quantity;
                acc.total += subtotal;
                acc.qty += item.quantity;

                // Add discount price if an active offer is not null
                if (item.product.activeOffer && item.product.offerDiscountedPrice) {
                    const discountSubtotal = item.product.offerDiscountedPrice * item.quantity;
                    acc.totalDiscountPrice += subtotal - discountSubtotal;
                }
            }
            return acc;
        }, { total: 0, qty: 0, totalDiscountPrice: 0 });

        const totAmtAftDisc = totalDiscountPrice > 0 ? total - totalDiscountPrice : total;
        console.log('Total Price:', total);
        console.log('Total Quantity:', qty);
        console.log('Total Discounted Price:', totalDiscountPrice);
        console.log('Offer Discount :', totAmtAftDisc);
        req.session.cartTotal = total;
        req.session.cartQty = qty;
        req.session.totalDiscount = totalDiscountPrice;
        req.session.totalAmtAftDisc = totAmtAftDisc;
        res.render('cart', { cart: cartData, total, qty, totalDiscountPrice, totAmtAftDisc })
    }
    catch (err) {
        console.log(err);
        res.status(500).send('Internal Server Error');
    }
}
const addProductToCart = async (req, res) => {
    //    console.log("user", req.session.user_id);
    const MAX_QTY_PER_PERSON = 10
    const prodId = req.params.id
    const userId = req.session.user_id
    const quantity = parseInt(req.body.quantity, 10)
    try {
        const product = await Product.findById({ _id: prodId })
        // console.log("prod",product);
        if (!product) {
            return res.status(404).send('Product not found')
        }
        if (quantity > product.stock) {
            return res.status(400).send(`Requested quantity (${quantity}) exceeds available stock (${product.stock}).`);
        }
        let cart = await Cart.findOne({ user: userId })
        // console.log("cart",cart);       
        if (!cart) {
            cart = new Cart({ user: userId, items: [] })
        }
        const cartItem = cart.items.find(item => item.product.toString() == prodId)
        // if(cartItem){
        //     const newQty = cartItem.quantity + quantity
        //     if(newQty>MAX_QTY_PER_PERSON){
        //         cartItem.quantity = Math.min(MAX_QTY_PER_PERSON,product.stock)
        //         res.send(`Maximum quantity for this product is ${MAX_QTY_PER_PERSON}.`);
        //     }
        //     else if(newQty>product.stock){
        //         cartItem.quantity = product.stock
        //         res.send(`Requested quantity exceeds available stock.`);
        //     }
        //     else{
        //         cartItem.quantity = newQty
        //     }           
        // }else{
        //     if(quantity>MAX_QTY_PER_PERSON){
        //         const qtyToAdd = Math.min(MAX_QTY_PER_PERSON,product.stock)
        //         cart.items.push({product:prodId,quantity:qtyToAdd})
        //     }
        //     else if(quantity>product.stock){
        //         cart.items.push({product:prodId,quantity:product.stock})
        //     }
        //     else{
        //         cart.items.push({product:prodId,quantity:quantity})
        //     }          
        // }
        if (cartItem) {
            const newQty = cartItem.quantity + quantity;
            cartItem.quantity = Math.min(newQty, Math.min(product.stock, MAX_QTY_PER_PERSON));
        } else {
            const qtyToAdd = Math.min(quantity, Math.min(product.stock, MAX_QTY_PER_PERSON));
            cart.items.push({ product: prodId, quantity: qtyToAdd });
        }
        await cart.save()
        const userCartData = await User.findByIdAndUpdate(userId, { cart: cart._id })
        req.session.userCartId = userCartData.cart
        // console.log("ses",req.session.userCartId);       
        res.redirect('/cart')
    }
    catch (err) {
        console.log("An error occurred while adding product to the cart", err);
        return res.status(500).send('An internal server error occurred. Please try again later.');
    }
}
const removeProductFromCart = async (req, res) => {
    // console.log("ses",req.session.user_id);
    // console.log("prod",req.params.prodId);
    const userId = req.session.user_id
    const prodId = req.params.prodId
    try {
        const user = await User.findById(userId).populate('cart')
        if (!user || !user.cart) {
            return res.status(404).send('Cart not found');
        }
        let cart = user.cart;
        // console.log("user",user);
        cart.items = cart.items.filter(item => !item.product.equals(prodId))
        await cart.save()
        res.redirect('/cart')
    }
    catch (err) {
        console.log("An error occurred while removing the product from the cart", err);
        return res.status(500).send('An internal server error occurred. Please try again later.');
    }
}

const updateCartQuantity = async (req, res) => {
    try {
        const userId = req.session.user_id;
        const { productId, quantity } = req.body;
        console.log(userId, productId, quantity);

        // Find the user and populate cart items
        const user = await User.findById(userId).populate({
            path: 'cart',
            populate: {
                path: 'items.product'
            }
        });

        // Find the cart item by productId
        const cartItem = user.cart.items.find(item => item.product._id.toString() === productId);
        console.log(cartItem);

        if (cartItem) {
            // Update the quantity
            cartItem.quantity = parseInt(quantity);
            await user.cart.save();

            // Recalculate total, quantity, and totalDiscountPrice
            let total = 0;
            let qty = 0;
            let totalDiscountPrice = 0;

            user.cart.items.forEach(item => {
                const priceToUse = item.product.price;  // Use discounted price if available
                const subtotal = priceToUse * item.quantity;
                total += subtotal;
                qty += item.quantity;

                // If an active offer exists, calculate the discount
                if (item.product.activeOffer && item.product.offerDiscountedPrice) {
                    const discountSubtotal = item.product.offerDiscountedPrice * item.quantity;
                    totalDiscountPrice += subtotal - discountSubtotal;
                }
            });

            // Calculate total amount after discount if applicable
            const totAmtAftDisc = totalDiscountPrice > 0 ? total - totalDiscountPrice : total;

            // Update session data
            req.session.cartTotal = total;
            req.session.cartQty = qty;
            req.session.totalDiscount = totalDiscountPrice;
            req.session.totalAmtAftDisc = totAmtAftDisc;
            console.log("total", total);
            console.log("totalDiscountPrice", totalDiscountPrice);
            console.log("totAmtAftDisc", totAmtAftDisc);
            // res.status(200).send('Cart updated');
            res.json({
                total: total.toFixed(2),
                totalDiscountPrice: totalDiscountPrice.toFixed(2),
                totalAfterDiscount: totAmtAftDisc.toFixed(2),
                qty
            });
        } else {
            res.status(404).send('Item not found');
        }
    } catch (err) {
        console.log("Error updating cart quantity", err);
        res.status(500).send('An error occurred while updating cart');
    }
};

module.exports = { loadCart, addProductToCart, removeProductFromCart, updateCartQuantity }