const User = require('../../models/userModel')
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb')

//account
const loadAccount = async (req, res) => {
    try {
        const userId = req.session.user_id;
        if (!userId) {
            return res.status(400).render('error', { title: 400, message: 'User not logged in. Please log in to access your account.' });
        }
        const user = await User.findById({ _id: userId })
        if (!user) {
            return res.status(404).render('404', { status: 404, message: 'User not found. Please try again later.' });
        }
        console.log("user", user);

        res.render('account', { user })
    }
    catch (err) {
        console.error("Error loading account:", err);
        res.status(500).render('error', { message: 'An error occurred while loading your account. Please try again later.' });
    }
}
//account-details
const loadAccountDetails = async (req, res) => {
    try {
        if (!req.session.user_id) {
            return res.status(401).render('error', { message: 'Unauthorized access. Please log in.' });
        }

        const userData = await User.findOne({ _id: new ObjectId(req.session.user_id) });
        if (!userData) {
            return res.status(404).render('error', { message: 'User not found. Please try again later.' });
        }

        console.log("User data:", userData);
        res.render('partials/account-details', { user: userData });
    } catch (err) {
        console.error("Error loading account details:", err);
        res.status(500).render('error', { message: 'An error occurred while loading account details. Please try again later.' });
    }
};
const getEditAccount = async (req, res) => {
    try {
        // Check if user_id exists in session
        if (!req.session.user_id) {
            return res.status(401).render('error', { success: false, message: 'Unauthorized access. Please log in.' });
        }

        const userData = await User.findOne({ _id: req.session.user_id });

        // Check if user data was found
        if (!userData) {
            return res.status(404).render('error', { success: false, message: 'User not found. Please try again later.' });
        }

        console.log("User data:", userData);
        res.render('partials/edit-account', { user: userData });
    } catch (err) {
        console.error("Error loading edit account details:", err); // Log the error for debugging
        res.status(500).render('error', { success: false, message: 'An error occurred while loading account details. Please try again later.' });
    }
};

const updateEditAccount = async (req, res) => {
    try {
        console.log("reqs", req.session.user_id);
        const { firstname, lastname, email, mobile } = req.body
        console.log(req.body)
        if (!req.session.user_id) {
            return res.status(401).render('error', { success: false, message: 'Unauthorized access. Please log in.' });
        }
        // const updateAccountData = await User.updateOne(
        //     { _id: req.session.user_id },
        //     { $set: { firstname, lastname, mobile } }
        // )    
        const updateAccountData = await User.findByIdAndUpdate(
            req.session.user_id,
            { $set: { firstname, lastname, email, mobile } },
            { new: true, runValidators: true } // Return the updated document and run validators
        );
        if (updateAccountData.nModified === 0) {
            return res.status(400).render('error', { success: false, message: 'No changes were made to your account.' });
        }
        // const userData = await User.findOne({ _id: req.session.user_id })  
        res.json({ success: true, message: 'Account updated successfully.' });
        // res.redirect('/account')  
        // res.render('partials/account-details',{user:userData})
    }
    catch (err) {
        console.error("Error updating account details:", err);
        res.status(500).render('error', { success: false, message: 'An error occurred while updating your account. Please try again later.' });
    }
}

module.exports = {
    loadAccount, loadAccountDetails, getEditAccount, updateEditAccount
}