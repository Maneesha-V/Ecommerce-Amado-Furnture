const User = require('../../models/userModel')
const Address = require('../../models/addressModel')
const mongoose = require('mongoose');
const { ObjectId } = require("mongodb")
const { deleteOne } = require('../../models/productModel')
//address
const loadAddress = async (req, res) => {
    try {
        const userId = req.session.user_id
        console.log("userid", userId);

        const user = await User.findById(userId);
        if (!user) {
            console.error("User not found");
            return res.status(404).render('404', { message: "User not found." });
        }
        console.log("addres", user);

        res.render('partials/address', { user })
    }
    catch (err) {
        console.error("Error loading address:", err);
        res.status(500).render('500', { message: "An error occurred while loading addresses." });
    }
}
const getAddAddress = async (req, res) => {
    try {
        res.render('partials/add-address')
    }
    catch (err) {
        console.error("Error rendering add-address partial:", err);
        res.status(500).render('500', { message: "An error occurred while rendering the address form. Please try again later." });
    }
}
const addAddress = async (req, res) => {
    const { name, addressLine1, addressLine2, mobile, city, district, state, zip } = req.body
    const userId = req.session.user_id
    if (!name || !addressLine1 || !addressLine2 || !mobile || !city || !district || !state || !zip) {
        return res.status(400).json({ success: false, message: 'Required fields are missing' });
    }

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const newAddress = {
            _id: new mongoose.Types.ObjectId(),
            name,
            addressLine1,
            addressLine2,
            mobile,
            city,
            state,
            district,
            zip,
            userId: userId
        };

        user.addresses.push(newAddress);
        await user.save();
        // res.redirect('/account')
        res.status(200).json({ success: true, message: 'Address added successfully', address: newAddress });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
const deleteAddress = async (req, res) => {
    try {
        const addressId = req.params.id
        const user = await User.findById({ _id: req.session.user_id })
        if (!user) {
            res.status(500).json({ success: false, message: 'User not found.' });
        }

        const addressExists = user.addresses.some(address => address._id.toString() === addressId);

        if (!addressExists) {
            return res.status(404).json({ success: false, message: 'Address not found.' }); // 404 for address not found
        }
        user.addresses = user.addresses.filter(address => address._id.toString() !== addressId);
        await user.save()
        return res.json({ success: true, message: 'Address deleted successfully.' });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: 'Failed to delete address.' });
    }
}
const setDefaultAddress = async (req, res) => {
    try {
        const userId = req.session.user_id;
        const { addressId } = req.body;
        if (!userId || !addressId) {
            return res.status(400).json({ success: false, message: 'User ID and Address ID are required.' });
        }
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        user.defaultAddress = addressId
        await user.save()
        console.log("default", user);
        return res.status(200).json({ success: true, message: 'Default address updated successfully.', user });
    }
    catch (err) {
        console.error('Error updating default address:', err);
        return res.status(500).json({ success: false, message: 'An error occurred while updating the default address.' });
    }
}

const getEditAddress = async (req, res) => {
    console.log(req.params.defAddressId, req.session.user_id);
    const defAddressId = req.params.defAddressId
    const userId = req.session.user_id
    try {
        const user = await User.findById({ _id: userId }).populate('addresses')
        console.log("user", user);
        if (!user) {
            return res.status(404).send("User not found")
        }
        const selectedAddress = user.addresses.find(address => address._id.equals(defAddressId))
        console.log("seleadd", selectedAddress);

        res.render('partials/edit-address', { address: selectedAddress })
    }
    catch (err) {
        console.error("Error retrieving address:", err);
        res.status(500).send("An error occurred while retrieving the address.");
    }
}

const updateEditAddress = async (req, res) => {
    const { defAddressId } = req.params; // Extract defAddressId from URL parameters
    const { name, addressLine1, addressLine2, mobile, city, district, state, zip } = req.body; // Extract form data

    try {
        // Find the user by their ID
        const user = await User.findById({ _id: req.session.user_id });
        console.log("user", user);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Update the specific address in the user's addresses array
        const updateAddress = await User.updateOne(
            { _id: req.session.user_id, 'addresses._id': defAddressId },
            {
                $set: {
                    'addresses.$.name': name,
                    'addresses.$.addressLine1': addressLine1,
                    'addresses.$.addressLine2': addressLine2,
                    'addresses.$.mobile': mobile,
                    'addresses.$.city': city,
                    'addresses.$.district': district,
                    'addresses.$.state': state,
                    'addresses.$.zip': zip
                }
            }
        );

        // Check if the update was successful
        if (updateAddress.modifiedCount === 0) {
            return res.status(400).json({ success: true, message: "No address was updated." });
        }

        console.log("Updated address", updateAddress);
        // Respond with success message
        return res.status(200).json({ success: true, message: "Address updated successfully." });
    } catch (err) {
        console.error("Error updating address:", err);
        return res.status(500).json({ success: false, message: "An error occurred while updating the address." });
    }
};

module.exports = {
    loadAddress, getAddAddress, addAddress, deleteAddress, setDefaultAddress,
    getEditAddress, updateEditAddress
}