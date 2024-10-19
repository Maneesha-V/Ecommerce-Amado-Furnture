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
    console.log("Session ID:", req.session.userId); // Log the session user ID
    console.log("session", req.session);

    try {
        if (!req.session.userId) {
            return next(); // Allow access if user is not logged in
        }
        return res.redirect('/home'); // Redirect if user is logged in
    } catch (err) {
        console.error(err);
        return res.status(500).send('Server error');
    }
}
module.exports = { isLogin, isLogout }