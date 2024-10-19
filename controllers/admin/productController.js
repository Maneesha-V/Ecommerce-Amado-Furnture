const User = require('../../models/userModel')
const Product = require('../../models/productModel')
const Category = require('../../models/categoryModel')
const Brand = require('../../models/brandModel')
const multer = require('../../middleware/multer')
const path = require("path")
const fs = require("fs")
const { ObjectId } = require('mongodb')

//products
const loadProducts = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;
    try {

        const productData = await Product.find()
            .populate('brand', 'brand_name')
            .populate('categoryId', 'name')
            .skip(skip)
            .limit(limit)
            .exec();

        const totalProducts = await Product.countDocuments();

        // Calculate total pages based on limit
        const totalPages = Math.ceil(totalProducts / limit);

        // If page is out of bounds, redirect to the last valid page
        if (page > totalPages && totalProducts > 0) {
            return res.redirect(`?page=${totalPages}`);
        }

        res.render('products', {
            status: true,
            productData,
            currentPage: page,
            totalPages,
            limit
        });
    }
    catch (err) {
        console.error("Error fetching products:", err);
        res.json({ status: false, message: "Error products not getting" })
    }
}
const getAddProduct = async (req, res) => {
    try {
        const categoryData = await Category.find({ isDelete: false })
        const brandData = await Brand.find()
        res.render('add-product', { categoryData, brandData })
    }
    catch (err) {
        console.error("Error fetching categories or brands:", err);
        return res.status(500).render('error', {
            title: 500,
            message: "Failed to load categories or brands. Please try again later."
        });
    }
}
const getEditProduct = async (req, res) => {
    try {
        const productId = req.params.id
        const categoryData = await Category.find({ isDelete: false })
        const brandData = await Brand.find()
        const editProductData = await Product.findById({ _id: productId })
        if (!editProductData) {
            return res.status(404).render('error', {
                title: 404,
                message: "Product not found."
            });
        }
        res.render('edit-product', { products: editProductData, categories: categoryData, brands: brandData })
    }
    catch (err) {
        console.error("Error fetching product or related data:", err);
        return res.status(500).render('error', {
            title: 500,
            message: "Failed to load product data. Please try again later."
        });
    }
}
const updateProduct = async (req, res) => {
    try {
        console.log(req.body)
        const productId = req.params.id
        const updateProduct = {
            name: req.body.name,
            description: req.body.description,
            price: req.body.price,
            stock: req.body.stock,
            categoryId: req.body.category,
            brand: req.body.brand
        }
        // console.log("up",updateProduct)
        if (req.files && req.files.length > 0) {
            const files = req.files
            const newImages = files.map(file => {
                const relativePath = file.path.split('public\\')[1];
                return relativePath;
            });

            const existingImages = Array.isArray(req.body.existingImages) ? req.body.existingImages : req.body.existingImages ? [req.body.existingImages] : []
            updateProduct.prodImages = [...existingImages, ...newImages]
        }
        const updatedProduct = await Product.findByIdAndUpdate(productId, updateProduct, { new: true })
        if (!updatedProduct) {
            return res.status(404).render('error', {
                title: 404,
                message: "Product not found."
            });
        }
        res.redirect('/admin/products')
    }
    catch (err) {
        console.error("Error updating product:", err);
        return res.status(500).render('error', {
            title: 500,
            message: "Failed to update the product. Please try again later."
        });
    }
}
const insertProduct = async (req, res) => {
    try {
        const { name, description, price, stock, category, brand } = req.body;
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).render('400', { status: 400, message: "No images uploaded." });
        }
        console.log(req.body);
        const imagePaths = files.map(file => {
            const relativePath = file.path.split('public\\')[1];
            return relativePath;
        });
        // console.log("path",imagePaths);
        const product = new Product({
            name,
            description,
            price,
            stock,
            categoryId: category,
            brand: brand,
            prodImages: imagePaths
        });
        await product.save()
        res.redirect('/admin/products')
        // res.json({status : true , message : "Product add success"})
    }
    catch (err) {
        console.error("Error inserting product:", err);
        res.status(500).render('500', { status: 500, message: "Product addition failed. Please try again later." });
    }
}
const deleteImage = async (req, res) => {
    try {
        const { prodId } = req.params
        const { image } = req.body
        console.log("image", image);
        const productData = await Product.findById(prodId)
        console.log("prod", productData);
        if (!productData) {
            return res.status(404).render('error', { title: 404, message: 'Product not found' });
        }
        const imagePath = path.join(__dirname, '../public/', image)
        console.log("path", imagePath);
        fs.access(imagePath, fs.constants.F_OK, (err) => {
            if (err) {
                return res.status(404).render('404', { status: 404, message: 'Image file not found' });
            }
        });
        fs.unlink(imagePath, (err) => {
            if (err) {
                console.error('Error deleting image file:', err);
                return res.status(500).render('error', { title: 500, message: 'Error deleting image file' });
            }
        });
        productData.prodImages = productData.prodImages.filter(img => img !== image);
        await productData.save()
        res.json({ success: true, message: 'Image deleted successfully' });

    }
    catch (err) {
        console.log("Error in deleteImage", err);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    }
}
const hideProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findOne({ _id: new ObjectId(productId) });
        if (!product) {
            return res.status(404).send({ message: 'Product not found' });
        }
        const blockState = !product.is_block
        const hideProductData = await Product.updateOne(
            { _id: new ObjectId(productId) },
            { $set: { 'is_block': blockState } })
        if (hideProductData.modifiedCount > 0) {
            return res.redirect('/admin/products')
        } else {
            return res.status(500).send({ message: 'Failed to hide product' });
        }
    }
    catch (err) {
        console.error('Error hiding product:', err);
        return res.status(500).send({ message: 'Server error' });
    }
}

module.exports = {
    loadProducts, deleteImage, getAddProduct, getEditProduct, insertProduct, updateProduct,
    hideProduct
}