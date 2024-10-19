const Coupon = require("../../models/couponModel")
const { ObjectId } = require('mongodb')

const formatDate = (date) => {
    return new Date(date).toLocaleString('en-IN', { dateStyle: 'short' });
};
const loadCoupon = async (req, res) => {
    try {
        const coupons = await Coupon.find().populate('usedBy', 'email')
        console.log("coupons", coupons);
        res.render('coupons', { coupons, formatDate })
    }
    catch (err) {
        console.log(err);
        res.status(500).render('500', { status: 500, message: 'Server Error' });
    }
}
const getAddCoupon = async (req, res) => {
    try {
        res.render('add-coupon')
    }
    catch (err) {
        console.log(err);
        res.status(500).render('500', { status: 500, message: 'Server Error' });
    }
}
const createCoupon = async (req, res) => {
    try {
        console.log(req.body);
        const { code, discountType, discountValue, minAmount, maxAmount, validFrom, validUntil, couponLimit, description } = req.body;
        const newCoupon = new Coupon({
            code,
            discountType,
            discountValue,
            minAmount,
            maxAmount: maxAmount || null,
            validFrom,
            validUntil,
            couponLimit,
            description
        })
        await newCoupon.save();
        res.redirect('/admin/coupons');
    }
    catch (err) {
        if (err.code = 11000) {
            const errorMessage = `Coupon code "${req.body.code}" already exists. Please use a different code.`;
            return res.status(400).render('add-coupon', {
                errorMessage,
                formData: req.body // Keep the form data to display on the page
            });
        } else {
            console.log(err);
            res.status(500).send('Error fetching coupons');
        }
    }
}
const hideCoupon = async (req, res) => {
    try {
        const { couponId } = req.params
        console.log("couponId", couponId);
        const coupon = await Coupon.findOne({ _id: new ObjectId(couponId) })
        console.log("coupon", coupon);
        const blockState = !coupon.isActive
        console.log("blockState", blockState);
        const hideCouponData = await Coupon.updateOne(
            { _id: new ObjectId(couponId) },
            { $set: { isActive: blockState } }
        )
        if (hideCouponData.modifiedCount > 0) {
            res.redirect('/admin/coupons')
        } else {
            res.send({ message: 'Failed to hide product' })
        }
    }
    catch (err) {
        console.log(err);
        res.status(500).render('500', { status: 500, message: 'Server Error' });
    }
}
module.exports = { loadCoupon, getAddCoupon, createCoupon, hideCoupon }