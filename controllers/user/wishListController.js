const Product = require("../../models/productModel")
const Wishlist = require('../../models/wishlistModel');

const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user_id
        const wishlist = await Wishlist.findOne({ user: userId }).populate('products');
        res.render('wishlist', { products: wishlist ? wishlist.products : [] });
    }
    catch (err) {
        console.error("Error loading wishlist:", err);
        res.status(500).render('error', { title: 500, message: 'An error occurred while loading your wishlist. Please try again later.' });
    }
}
const addProdShopToWishList = async (req, res) => {
    try {
        const productId = req.params.prodId
        console.log("prod", productId);
        const product = await Product.findById(productId)
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        console.log("product", product);
        const userId = req.session.user_id
        let wishlist = await Wishlist.findOne({ user: userId })
        if (!wishlist) {
            wishlist = new Wishlist({
                user: userId,
                products: [productId]
            })
        } else {
            if (!wishlist.products.includes(productId)) {
                wishlist.products.push(productId)
            }
        }
        await wishlist.save();
        res.status(200).json({ success: true, message: 'Product added to wishlist' });
    }
    catch (err) {
        console.log("Error adding product to wishlist:", err);
        res.status(500).json({ success: false, message: 'Failed to add product to wishlist' });
    }
}
const remProdFromWishList = async (req, res) => {
    try {
        const userId = req.session.user_id;
        const productId = req.params.prodId;
        console.log("user prod", userId, productId);
        const wishlist = await Wishlist.findOne({ user: userId });
        if (wishlist) {
            // wishlist.products = wishlist.products.filter(id => id.toString() !== productId);
            wishlist.products = wishlist.products.filter(product => product && product._id && product._id.toString() !== productId);
            await wishlist.save();
        }
        res.redirect('/wishlist');
    }
    catch (err) {
        console.error("Error removing product from wishlist:", err);
        res.status(500).render('error', { title: 500, message: 'Error removing product from wishlist' });
    }
}

module.exports = { loadWishlist, addProdShopToWishList, remProdFromWishList }