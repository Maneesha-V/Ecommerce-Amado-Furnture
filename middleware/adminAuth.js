const isLogin = async (req, res, next) => {
    try {
        if (!(req.session.adminId && req.session.isAdmin)) {
            return res.redirect('/admin/login')
        }
        next();
    }
    catch (err) {
        console.log(err);
        res.status(500).send('Server Error');
    }
}
const isLogout = async (req, res, next) => {
    try {
        if (req.session.adminId && req.session.isAdmin) {
            return res.redirect('/admin/dashboard')
        }
        next();
    }
    catch (err) {
        console.log(err);
        res.status(500).send('Server Error');
    }
}

module.exports = { isLogin, isLogout }