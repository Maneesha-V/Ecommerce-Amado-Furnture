const Category = require('../../models/categoryModel');
const { ObjectId } = require('mongodb')

//category
const getAddCategory = async (req, res) => {
    try {
        const { newBrand } = req.body
        const page = parseInt(req.query.page) || 1; // Get the current page number from query params or default to 1
        const limit = 5; // Number of categories per page
        const skip = (page - 1) * limit; // Calculate the number of documents to skip
        // Get the total count of categories
        const totalCategories = await Category.countDocuments();

        // Fetch the categories with pagination
        const categoryData = await Category.find()
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalCategories / limit); // Calculate the total number of pages

        res.render('category', {
            categories: categoryData,
            error: null,
            newBrand: '',
            currentPage: page,
            totalPages: totalPages, limit
        });
    }
    catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).send({ message: 'Server error' });
    }
}
const addCategory = async (req, res) => {
    try {
        const { name } = req.body
        const { page = 1 } = req.query
        const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
        const totalCategories = await Category.countDocuments()
        if (existingCategory) {
            let categories = await Category.find()
                .skip((page - 1) * 5)
                .limit(5);
            const totalPages = Math.ceil(totalCategories / 5)
            res.render('category', {
                categoryError: "Category already exists", brandError: '', categories,
                currentPage: parseInt(page), totalPages, limit: 5
            })
        } else {
            const categoryData = new Category({
                name: name
            })
            await categoryData.save()
            const categories = await Category.find()
                .skip((page - 1) * 5)
                .limit(5);
            const totalPages = Math.ceil(totalCategories / 5)
            res.render('category', {
                categories,
                categoryError: '',
                brandError: '',
                currentPage: parseInt(page),
                totalPages,
                limit: 5
            });
        }
    }
    catch (err) {
        console.log(err);
        res.render('category', {
            categories: [],
            categoryError: 'An error occurred while adding the category.',
            brandError: '',
            currentPage: parseInt(page),
            totalPages: 1,
            limit: 5
        });
    }
}
const updateCategory = async (req, res) => {
    try {
        const categoryId = req.params.id
        console.log("categoryId", categoryId);

        const updateCategory = {
            name: req.body.name
        }
        console.log("updateCategory", updateCategory);
        const updatedCategory = await Category.findByIdAndUpdate(categoryId, updateCategory, { new: true })
        if (!updatedCategory) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.redirect('/admin/category');
    }
    catch (err) {
        console.error('Error while updating category:', err);
        res.status(500).json({ success: false, message: 'An error occurred while updating the category' });
    }
}

const deleteCategory = async (req, res) => {
    const { id } = req.params
    try {
        const categoryData = await Category.findById({ _id: new ObjectId(id) })
        console.log(categoryData);
        if (!categoryData) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        const deleteState = !categoryData.isDelete
        console.log(deleteState);
        const deleteCategory = await Category.updateOne(
            { _id: new ObjectId(id) }, { $set: { 'isDelete': deleteState } })
        if (deleteCategory.modifiedCount > 0) {
            res.redirect('/admin/category')
        } else {
            res.send({ message: 'Failed to hide product' })
        }
    }
    catch (err) {
        console.error('Error while deleting category:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

module.exports = {
    getAddCategory, addCategory, updateCategory, deleteCategory
}