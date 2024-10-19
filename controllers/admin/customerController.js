
const User = require('../../models/userModel')
const { ObjectId } = require('mongodb')

//customers
const loadCustomers = async (req, res) => {
    try {
        const customerData = await User.find({ is_admin: false })
        // console.log("data",customerData);
        res.render('customers', { customers: customerData })
    }
    catch (err) {
        console.log("Error loading customers", err);
        res.status(500).render('500', { status: 500, message: 'Failed to load customer data. Please try again later.' });
    }
}
const blockCustomer = async (req, res) => {
    try {
        const customerId = req.params.id
        const customer = await User.findOne({ _id: new ObjectId(customerId) })
        const blockState = !customer.is_block
        const hideCustomerData = await User.updateOne(
            { _id: new ObjectId(customerId) },
            { $set: { 'is_block': blockState } }
        )
        // console.log(hideCustomerData)
        if (hideCustomerData.matchedCount > 0) {
            res.redirect('/admin/customers')
        } else {
            res.send({ message: 'Failed to hide customer' })
        }
    }
    catch (err) {
        console.error('Error blocking/unblocking customer:', err);
        res.status(500).render('500', {
            status: 500, message: 'An error occurred while blocking/unblocking the customer. Please try again.'
        });
    }
}

module.exports = {
    loadCustomers, blockCustomer
}