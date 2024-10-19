const Category = require("../../models/categoryModel")
const Product = require("../../models/productModel")
const Brand = require("../../models/brandModel")
const Cart = require("../../models/cartModel")
const Offer = require("../../models/offerModel")
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const ITEMS_PER_PAGE = 4;

const loadShop = async (req, res) => {
    try {
        req.session.previousPage = 'shop';
        const categoryData = await Category.find({ isDelete: false })
        // const productData = await Product.find({ is_block: false })
        const brandData = await Brand.find({ isDelete: false })
        const search = req.query.search || ''
        const sort = req.query.sort || ''
        const category = req.query.category || ''
        const brand = req.query.brand || ''
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * ITEMS_PER_PAGE;
        const query = {
            is_block: false,
            ...(search && { name: new RegExp(search, 'i') }),
            ...(category && { categoryId: category }),
            ...(brand && { brandId: brand })
        };

        const totalProducts = await Product.countDocuments(query)
        let productData = await Product.find(query)
            .skip(skip)
            .limit(ITEMS_PER_PAGE)
            .sort(sort ? { price: sort === 'price-low-high' ? 1 : -1 } : {})
            .exec();
        // Get active offers for each product
        console.log("product-first", productData);

        const productIds = productData.map(product => product._id);
        const categoryIds = categoryData.map(cat => cat._id);
        const activeOffers = await Offer.find({
            isActive: true,
            applicableTo: { $in: ['Product', 'Category'] },
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            $or: [
                { applicableTo: 'Product', applicableId: { $in: productIds } },
                { applicableTo: 'Category', applicableId: { $in: categoryIds } }
            ]
        }).exec();
        console.log("productIds", productIds);
        console.log("categoryIds", categoryIds);
        console.log("activeOffers", activeOffers);

        productData = await Promise.all(productData.map(async product => {
            console.log("product", product);

            // Find the product-specific offer, if any
            const productOffer = activeOffers.find(offer =>
                offer.applicableTo === 'Product' && offer.applicableId.equals(product._id)
            );
            console.log("productOffer", productOffer);
            console.log("Product Category ID:", product.categoryId);
            // Find the category-specific offer, if any
            const categoryOffer = activeOffers.find(offer =>
                offer.applicableTo === 'Category' && offer.applicableId.equals(product.categoryId)
            );
            console.log("categoryOffer", categoryOffer);

            if (productOffer && categoryOffer) {
                // Compare the discount percentages and apply the offer with the greater discount
                if (productOffer.discountPercentage > categoryOffer.discountPercentage) {
                    product.offerDiscountedPrice = product.price - (product.price * (productOffer.discountPercentage / 100));
                    product.activeOffer = productOffer._id;
                } else {
                    product.offerDiscountedPrice = product.price - (product.price * (categoryOffer.discountPercentage / 100));
                    product.activeOffer = categoryOffer._id;
                }
            } else if (productOffer) {
                // Apply product-specific offer
                product.offerDiscountedPrice = product.price - (product.price * (productOffer.discountPercentage / 100));
                product.activeOffer = productOffer._id;
            } else if (categoryOffer) {
                // Apply category-specific offer
                product.offerDiscountedPrice = product.price - (product.price * (categoryOffer.discountPercentage / 100));
                product.activeOffer = categoryOffer._id;
            } else {
                // No offer applied
                product.offerDiscountedPrice = product.price;
                product.activeOffer = null;
            }

            // Update the product in the database
            await Product.updateOne(
                { _id: product._id },
                {
                    offerDiscountedPrice: product.offerDiscountedPrice,
                    activeOffer: product.activeOffer
                }
            );
            console.log("Updated Product:", product);

            return product; // Return the updated product
        }));


        console.log("productData", productData);
        const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);
        // console.log("pr",productData);    
        res.render('shop', {
            categories: categoryData, products: productData, brands: brandData,
            search, sort, brand, category, currentPage: page, totalPages
        })
    }
    catch (err) {
        console.log("Error loading shop", err);
        // Check for specific error types
        if (err.name === 'MongoError') {
            // Handle MongoDB specific errors
            return res.status(500).render('500', {
                status: 500,
                message: 'A database error occurred. Please try again later.'
            });
        } else if (err instanceof TypeError) {
            // Handle TypeErrors
            return res.status(400).render('500', {
                status: 400,
                message: 'There was an issue with the request parameters.'
            });
        } else {
            // General error handling
            return res.status(500).render('500', {
                status: 500,
                message: 'An error occurred while loading the shop. Please try again later.'
            });
        }
    }
}

const getSortProduct = async (req, res) => {
    try {
        const { search, sort, category, brand, page = 1 } = req.query
        const ITEMS_PER_PAGE = 4;
        const skip = (parseInt(page) - 1) * ITEMS_PER_PAGE;
        console.log("query", req.query);
        console.log("sr", search);

        let query = {}
        let sortOption = {}
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        if (category) {
            query.categoryId = ObjectId(category)
        }
        if (brand) {
            query.brand = ObjectId(brand)
        }
        console.log("id", query);

        switch (sort) {
            case 'popularity':
                sortOption.popularity = -1;
                break;
            case 'price-low-high':
                sortOption.price = 1;
                break;
            case 'price-high-low':
                sortOption.price = -1;
                break;
            case 'average-rating':
                sortOption.averageRating = -1;
                break;
            case 'featured':
                sortOption.featured = -1;
                break;
            case 'new-arrivals':
                sortOption.createdAt = -1;
                break;
            case 'a-z':
                sortOption.name = 1;
                break;
            case 'z-a':
                sortOption.name = -1;
                break;
            default:
                sortOption.createdAt = -1
        }

        const categories = await Category.find({ isDelete: false })
        const brands = await Brand.find({ isDelete: false })
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);

        const products = await Product.find(query)
            .skip(skip)
            .limit(ITEMS_PER_PAGE)
            .sort(sortOption)
            .exec();
        // const products = await Product.find(query).sort(sortOption).exec();
        // console.log("sort",products);

        res.render('shop', {
            products, search, sort, categories, brands, category, brand, currentPage: parseInt(page),
            totalPages
        })
    }
    catch (err) {
        console.error("Error fetching sorted products:", err);
        // Render an error page
        res.status(500).render('500', {
            status: 500,
            message: 'An error occurred while fetching the products. Please try again later.'
        });
    }
}
const addProdShopToCart = async (req, res) => {
    try {
        const userId = req.session.user_id
        const productId = req.params.prodId
        const { quantity } = req.body;
        const requestedQuantity = parseInt(quantity, 10);
        const product = await Product.findById(productId)
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        let cart = await Cart.findOne({ user: userId })
        console.log("cart", cart);
        if (!cart) {
            cart = new Cart({ user: userId, items: [] })
        }
        let cartItem = cart.items.find(item => item.product.toString() === productId)
        console.log("cartItem", cartItem);
        if (cartItem) {
            const newQuantity = cartItem.quantity + requestedQuantity
            if (newQuantity > product.stock) {
                return res.status(400).json({ message: 'Insufficient stock. Cannot add more items.' });
            } else {
                cartItem.quantity = newQuantity
            }
        } else {
            if (requestedQuantity > product.stock) {
                return res.status(400).json({ message: 'Insufficient stock. Cannot add more items.' });
            }
            cart.items.push({ product: productId, quantity: requestedQuantity })
        }
        await cart.save()
        return res.status(200).json({ message: 'Product added to cart successfully' });
    }
    catch (err) {
        console.log("Error adding product to cart", err);
        return res.status(500).json({ message: 'Server error. Please try again later.' });
    }
}
module.exports = { loadShop, getSortProduct, addProdShopToCart }