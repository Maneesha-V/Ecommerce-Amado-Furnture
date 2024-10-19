const Category = require("../../models/categoryModel")
const Product = require("../../models/productModel")
const Brand = require("../../models/brandModel")
const Cart = require("../../models/cartModel")

const loadProductDetails = async (req, res) => {
    console.log("Request URL:", req.url); // Logs the full request URL
    console.log("Query parameters:", req.query); // Logs query parameters
    try {
        const productId = req.params.id;
        const from = req.session.previousPage || 'home';
        const product = await Product.findById(productId)
            .populate('brand')
            .populate('categoryId')
            .populate('activeOffer')  // Populate the active offer if needed
            .exec();
        // Check if product is null
        if (!product) {
            console.log("Product not found");
            return res.status(404).render('404', { status: 404, message: 'Product not found', redirectUrl: '/home' });
        }
        console.log("pr", product);
        res.render('product-details', { product, from });
    }
    catch (err) {
        console.log("Error fetching product details", err);
        res.status(500).render('500', { status: 500, message: 'Server error occurred' });
    }
}

module.exports = {
    loadProductDetails
}