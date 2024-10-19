const Offer = require("../../models/offerModel")
const Category = require("../../models/categoryModel")
const Product = require("../../models/productModel")
const { ObjectId } = require('mongodb')

const loadOffer = async (req, res) => {
    try {
        const offers = await Offer.find().populate('applicableId');
        res.render('offers', { offers })
    }
    catch (err) {
        console.error('Error loading offers:', err);
        res.status(500).render('500', { status: 500, message: 'Server Error' });
    }
}
const getAddOffer = async (req, res) => {
    try {
        const categoryData = await Category.find({ isDelete: false })
        const productData = await Product.find({ is_block: false })
        res.render('add-offer', { categoryData, productData })
    }
    catch (err) {
        console.error('Error fetching data for adding offer:', err);
        res.status(500).render('500', { status: 500, message: 'Server Error' });
    }
}
const createOffer = async (req, res) => {
    try {
        const { offerName, discountPercentage, startDate, endDate, applicableTo, applicableId, categoryDropdown } = req.body;
        console.log("body", req.body);
        // Determine the applicable ID and model
        let applicableModel = '';
        let applicableIdValue = '';

        if (applicableTo === 'Product') {
            applicableModel = 'Product';
            applicableIdValue = applicableId; // Use the product ID from req.body
        } else if (applicableTo === 'Category') {
            applicableModel = 'Category';
            applicableIdValue = categoryDropdown; // Use the category ID from req.body
        } else {
            return res.status(400).send({ message: 'Invalid applicable type.' });
        }
        const newOffer = new Offer({
            offerName,
            discountPercentage,
            startDate,
            endDate,
            applicableTo,
            applicableId: applicableIdValue,
            applicableModel
        });

        // Save the offer to the database
        await newOffer.save();
        res.redirect('/admin/offers')
    }
    catch (err) {
        console.log(err);
        req.flash('error', 'Server error');
    }
}
const getEditOffer = async (req, res) => {
    try {
        const offerId = req.params.offerId
        console.log("params", offerId);
        const offer = await Offer.findById(offerId)
        console.log("offer", offer);
        const categoryData = await Category.find({ isDelete: false })
        const productData = await Product.find({ is_block: false })
        res.render('edit-offer', { offer, categoryData, productData })
    }
    catch (err) {
        console.log(err);
        res.status(500).render('500', { status: 500, message: 'Server Error' });
    }
}
const updateOffer = async (req, res) => {
    try {
        const offerId = req.params.offerId
        const { offerName, discountPercentage, startDate, endDate, applicableTo, categoryDropdown, applicableId } = req.body
        let applicableModel = '';
        let applicableIdValue = '';

        if (applicableTo === 'Product') {
            applicableModel = 'Product';
            applicableIdValue = applicableId; // Use the product ID from req.body
        } else if (applicableTo === 'Category') {
            applicableModel = 'Category';
            applicableIdValue = categoryDropdown; // Use the category ID from req.body
        } else {
            return res.status(400).send({ message: 'Invalid applicable type.' });
        }
        const updateData = {
            offerName,
            discountPercentage,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            applicableTo,
            applicableId: applicableIdValue,
            applicableModel
        }
        const updatedOffer = await Offer.findByIdAndUpdate(offerId, updateData, { new: true });

        if (!updatedOffer) {
            return res.status(404).send({ message: 'Offer not found' });
        }

        console.log("Offer updated successfully:", updatedOffer);

        // Redirect back to the offers page after successful update
        res.redirect('/admin/offers');
    }
    catch (err) {
        console.log(err);
        res.status(500).render('500', { status: 500, message: 'Server Error' });
    }
}
const hideOffer = async (req, res) => {
    try {
        const offerId = req.params.offerId
        const offer = await Offer.findById(offerId)
        const hideState = !offer.isActive
        const offerData = await Offer.updateOne({ _id: new ObjectId(offerId) },
            { $set: { 'isActive': hideState } }
        )
        if (offerData.modifiedCount > 0) {
            res.redirect('/admin/offers')
        } else {
            res.send({ message: 'Failed to hide product' })
        }
    }
    catch (err) {
        console.log(err);
        res.status(500).render('500', { status: 500, message: 'Server Error' });
    }
}

module.exports = { loadOffer, getAddOffer, createOffer, hideOffer, getEditOffer, updateOffer }