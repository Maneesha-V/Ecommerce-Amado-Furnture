const User = require("../models/userModel");
const isLogin = async (req, res, next) => {
    try {
        if (!req.session.user_id) {
            return res.redirect('/')
        }
        next();
    }
    catch (err) {
        console.log(err);
        res.status(500).send('Server error');
    }
}
const isLogout = async (req, res, next) => {
    console.log("Session ID:", req.session.userId);
    console.log("session", req.session);

    try {
        if (!req.session.userId) {
            return next(); 
        }
        return res.redirect('/home'); 
    } catch (err) {
        console.error(err);
        return res.status(500).send('Server error');
    }
}
const checkUserBlocked = async (req, res, next) => {
    const email = req.body.email;
    if (!email) {
        return res.render('login', { message: "Email is required" });
    }
    const userData = await User.findOne({ email: email });

    if (userData && userData.is_block) {
        return res.render('error', { message: "Your access is restricted", title: "Access Restricted" });
    }
    next();
};

module.exports = { isLogin, isLogout, checkUserBlocked }