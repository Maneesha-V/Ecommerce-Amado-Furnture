const Category = require('../../models/categoryModel')
const Brand = require('../../models/brandModel')

// brand
const addBrand = async (req, res) => {
    const { newBrand } = req.body;
    const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
    const limit = parseInt(req.query.limit) || 5; // Default limit is 5

    try {
        const existingBrand = await Brand.findOne({ brand_name: newBrand });
        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit); // Calculate total pages

        const categories = await Category.find()
            .skip((page - 1) * limit)
            .limit(limit);

        if (existingBrand) {
            res.render('category', {
                categories,
                categoryError: '',
                brandError: "Brand already exists",
                currentPage: page,
                totalPages,
                limit
            });
        } else {
            const brandData = new Brand({
                brand_name: newBrand
            });
            await brandData.save();
            res.redirect('/admin/add-product');
            console.log(brandData);
        }
    } catch (err) {
        console.log(err);
        res.redirect('/admin/category?page=1&limit=5');
    }
};

module.exports = { addBrand }