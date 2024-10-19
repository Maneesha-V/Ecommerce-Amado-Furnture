const User = require("../../models/userModel")

const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.user_id
        const total = req.session.cartTotal || 0
        const qty = req.session.cartQty || 0
        const totalDiscount = req.session.totalDiscount || 0
        const totAmtAftDisc = req.session.totalAmtAftDisc
        console.log("total-qty", total, qty);
        console.log("totalDiscount-totAmtAftDisc", totalDiscount, totAmtAftDisc);
        if (!userId) {
            console.error("UserId not found in this session");
            res.redirect('/login')
        }
        const userData = await User.findById(userId).populate('addresses')
        if (!userData) {
            console.error("User data not found")
            res.redirect('/login')
        }
        const savedAddresses = userData.addresses
        // console.log("useradd",userData.addresses); 
        res.render('checkout', { savedAddresses, total, qty, totalDiscount, totAmtAftDisc })
    }
    catch (err) {
        console.error("Error loading checkout:", err);
        res.redirect('/cart')
    }
}
const addNewAddress = async (req, res) => {
    try {
        const { name, mobile, addressline1, addressline2, city, district, state, zipCode } = req.body
        const newAddress = {
            name,
            mobile,
            addressLine1: addressline1,
            addressLine2: addressline2,
            city,
            district,
            state,
            zip: zipCode
        }
        const userId = req.session.user_id
        await User.findByIdAndUpdate(userId,
            { $push: { addresses: newAddress } }
        )
        res.redirect('/checkout')
    }
    catch (err) {
        console.log("Error adding new address:", err);
        res.redirect('/checkout');
    }
}
const editSavedAddress = async (req, res) => {
    try {
        const { name, mobile, addressline1, addressline2, city, district, state, zipCode } = req.body
        const userId = req.session.user_id
        const addressId = req.params.addressId
        await User.updateOne({ _id: userId, "addresses._id": addressId },
            {
                $set: {
                    "addresses.$.name": name,
                    "addresses.$.mobile": mobile,
                    "addresses.$.addressLine1": addressline1,
                    "addresses.$.addressLine2": addressline2,
                    "addresses.$.city": city,
                    "addresses.$.district": district,
                    "addresses.$.state": state,
                    "addresses.$.zip": zipCode
                }
            }
        )
        res.redirect('/checkout')
    }
    catch (err) {
        console.log("Error updating address:", err);
        res.redirect('/checkout');
    }
}

module.exports = { loadCheckout, addNewAddress, editSavedAddress }