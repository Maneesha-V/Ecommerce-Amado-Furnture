const User = require('../../models/userModel');
const bcrypt = require("bcrypt");

//auth
const loadLogin = async (req, res) => {
    try {
        res.render('login')
    }
    catch (err) {
        console.log(err.message);
        res.status(500).send('An error occurred while loading the login page.');
    }
}
const loginAdmin = async (req, res) => {
    try {
        const email = req.body.email
        const password = req.body.password
        const adminData = await User.findOne({ email: email })
        if (!adminData) {
            return res.render('login', {
                error: 'Invalid email or password',
                email
            });
        }
        if (adminData.is_admin !== true) {
            return res.render('login', {
                error: 'Unauthorized access',
                email
            });
        }
        const isPasswordValid = await bcrypt.compare(password, adminData.password);

        if (!isPasswordValid) {
            return res.render('login', {
                error: 'Invalid email or password',
                email
            });
        }

        req.session.adminId = adminData._id;
        req.session.isAdmin = adminData.is_admin;
        console.log(req.session);
        return res.redirect('/admin/dashboard');
    }
    catch (err) {
        console.log("Error during admin login.", err);
        return res.status(500).render('login', {
            error: 'Something went wrong. Please try again later.'
        });
    }
}
const loadLogout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log("Error destroying session:", err);
                return res.status(500).send('Failed to log out. Please try again.');
            }

            res.render('logout');
        });
    }
    catch (err) {
        console.error("Error during logout:", err);
        return res.status(500).send('Something went wrong. Please try again later.');
    }
}
const exitLogout = async (req, res) => {
    try {
        // Destroy the session
        req.session.destroy((err) => {
            if (err) {
                console.error("Error destroying session:", err);
                return res.status(500).send('Failed to log out. Please try again.');
            }

            // Session successfully destroyed
            console.log("Session destroyed:", req.session);  // This will likely be `undefined` since the session is destroyed
            res.redirect('/admin/login');
        });
    }
    catch (err) {
        // Log any unexpected errors
        console.error("Error during logout process:", err);

        // Respond with an internal server error
        return res.status(500).send('Something went wrong. Please try again later.');
    }
}

module.exports = {
    loadLogin, loginAdmin, loadLogout, exitLogout
}