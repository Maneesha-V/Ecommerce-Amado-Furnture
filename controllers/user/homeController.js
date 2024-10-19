const Product = require('../../models/productModel')

const loadHome = async (req, res) => {
    console.log("session", req.session);
    try {
        req.session.previousPage = 'home'
        const userId = req.session.userId
        const prodData = await Product.find({ is_block: false })
        res.render('home', { userId, products: prodData })
        // console.log(prodData)
    }
    catch (err) {
        console.error("Error loading home:", err);
        res.status(500).render('error', { title: 500, message: 'Error loading home page' });
    }
}
const getSearchDataFromHome = async (req, res) => {
    try {
        console.log("query", req.query);
        const searchItem = req.query.search;
        if (!searchItem) {
            return res.status(400).render('home', { products: [], error: "Please enter a search term." });
        }
        const products = await Product.find({ name: { $regex: searchItem, $options: 'i' } })
        res.render('home', { products })
    }
    catch (err) {
        console.error("Error during product search:", err);
        res.status(500).render('error', { title: 500, message: 'An error occurred while searching for products. Please try again later.' });
    }
}
module.exports = { loadHome, getSearchDataFromHome }