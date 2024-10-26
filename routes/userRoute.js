require('dotenv').config()
const express = require("express")
const bodyParser = require("body-parser")
const session = require("express-session")
const path = require('path')
const passport = require("passport")
require("../passport")
const multer = require("multer")
// const config = require("../config/config")
const authController = require("../controllers/user/authController")
const userController = require("../controllers/user/userController")
const addressController = require("../controllers/user/addressController")
const cartController = require("../controllers/user/cartController")
const shopController = require("../controllers/user/shopController")
const checkoutController = require("../controllers/user/checkoutController")
const orderController = require("../controllers/user/orderController")
const accountController = require("../controllers/user/accountController")
const productController = require("../controllers/user/productController")
const wishListController = require("../controllers/user/wishListController")
const homeController = require("../controllers/user/homeController")
const userAuth = require("../middleware/userAuth")
const { isLogin, isLogout, checkUserBlocked } = require("../middleware/userAuth")
const user_route = express()
const upload = multer()
user_route.use(session({
    secret: process.env.SESSION_SECRET, // Replace with your actual secret key
    resave: false, // Prevents the session from being saved back to the store if it wasn't modified during the request
    saveUninitialized: false, // Prevents uninitialized sessions from being saved to the store
    cookie: { secure: false }

}))
user_route.use(passport.initialize())
user_route.use(passport.session())

user_route.use(express.static(path.join(__dirname, '../public/userStyle')))

user_route.set('views', './views/users')

user_route.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }))
user_route.get('/auth/google/callback',
    passport.authenticate('google', {
        successRedirect: '/success',
        failureRedirect: '/failure'
    }));
user_route.get('/success', authController.successGoogleLogin)
user_route.get('/failure', authController.failureGoogleLogin)
user_route.get('/', isLogout, authController.loadLogin)
user_route.get('/login', isLogout, authController.loadLogin)
user_route.post('/login', isLogout, checkUserBlocked, authController.loginUser)
user_route.get('/signup', isLogout, authController.loadSignup)
user_route.post('/signup', isLogout, authController.insertUser)
user_route.get('/verify-otp', isLogout, authController.loadOtpSignUP)
user_route.post('/verify-otp', isLogout, authController.verifyOTP)
user_route.post('/resend-otp', isLogout, authController.resendOTP)
user_route.get('/forget-password', isLogout, authController.loadForgetPassword)
user_route.post('/forget-password', isLogout, authController.forgetPassword)
user_route.get('/reset-password/:userId/:token', authController.getResetPassword)
user_route.post('/reset-password/:userId/:token', authController.resetPassword)
user_route.get('/search', homeController.getSearchDataFromHome)
user_route.get('/home', homeController.loadHome)
user_route.get('/shop', shopController.loadShop)
user_route.get('/wishlist', isLogin, wishListController.loadWishlist)
user_route.post('/shop-to-wishlist/:prodId', isLogin, wishListController.addProdShopToWishList)
user_route.post('/wishlist/remove/:prodId', isLogin, wishListController.remProdFromWishList)
user_route.post('/shop-to-cart/:prodId', isLogin, upload.none(), shopController.addProdShopToCart)
// user_route.get('/shop/category/:categoryId',shopController.getCategoryInShop)
// user_route.get('/shop/brand',shopController.getBrandInShop)
user_route.get('/shop/advanced-search', shopController.getSortProduct)
user_route.get('/product-details/:id', productController.loadProductDetails)
// user_route.get('/category/:categoryId',productController.getProductsBasedCategory)
user_route.get('/checkout', isLogin, checkoutController.loadCheckout)
user_route.post('/save-address', isLogin, checkoutController.addNewAddress)
user_route.post('/edit-saved-address/:addressId', isLogin, checkoutController.editSavedAddress)
user_route.get('/cart', isLogin, cartController.loadCart)
user_route.post('/add-to-cart/:id', isLogin, cartController.addProductToCart)
user_route.post('/cart/update', isLogin, cartController.updateCartQuantity)
user_route.post('/cart/remove/:prodId', isLogin, cartController.removeProductFromCart)
// user_route.get('/order-summary',isLogin,orderController.loadOrderSummary)
user_route.post('/order-summary', isLogin, orderController.selectAddressForOrder)
user_route.post('/apply-coupon', isLogin, orderController.applyCoupon)
user_route.post('/remove-coupon', isLogin, orderController.removeCoupon)
user_route.post('/apply-repay-coupon', isLogin, orderController.applyRepayCoupon)
user_route.post('/add-money', isLogin, orderController.addMoneyToWallet)
user_route.post('/wallet-payment-verification', isLogin, orderController.verifyAndAddMoneyToWallet)
// user_route.post('/pay-with-wallet',orderController.paywithWallet)
user_route.post('/payment', isLogin, orderController.placeOrder)
user_route.post('/payment-verification', isLogin, orderController.cardPayment)
user_route.get('/order-confirmation', isLogin, orderController.loadOrderConfirmation)
user_route.get('/account/order-status/:orderId', isLogin, accountController.loadOrderStatus)
user_route.post('/remove-item/:orderId/:itemId', isLogin, upload.none(), accountController.removeItemFromPlacedOrder)
user_route.post('/return-item/:orderId/:itemId', isLogin, upload.none(), accountController.returnItemFromPlacedOrder)
user_route.get('/account', isLogin, userController.loadAccount)
user_route.get('/account/orders', isLogin, accountController.loadOrder)
user_route.get('/account/wallet', isLogin, accountController.loadWallet)
user_route.get('/account/account-details', isLogin, userAuth.isLogin, userController.loadAccountDetails)
user_route.get('/account/edit-account', isLogin, userController.getEditAccount)
user_route.post('/account/edit-account', isLogin, userController.updateEditAccount)
user_route.get('/account/address', isLogin, addressController.loadAddress)
user_route.get('/account/add-address', isLogin, addressController.getAddAddress)
user_route.post('/account/add-address', isLogin, addressController.addAddress)
user_route.get('/account/edit-address/:defAddressId', isLogin, addressController.getEditAddress)
user_route.post('/account/edit-address/:defAddressId', isLogin, addressController.updateEditAddress)
user_route.delete('/account/delete-address/:id', isLogin, addressController.deleteAddress)
user_route.post('/account/set-default-address', isLogin, addressController.setDefaultAddress)
user_route.get('/account/change-password', isLogin, accountController.getChangePassword)
user_route.post('/account/change-password', isLogin, accountController.updateChangePassword)
user_route.get('/account/download-invoice/:orderId', isLogin, accountController.downloadInvoice)
user_route.get('/order-summary/:orderId', isLogin, orderController.loadOrderSummary)
user_route.post('/repayment/:orderId', isLogin, accountController.orderRepayment)
// user_route.post('/check-email',userController.emailValidate)
// user_route.post('/check-mobile',userController.mobileValidate)
user_route.get('/logout', isLogin, authController.loadLogout)
user_route.post('/logout', isLogin, authController.exitLogout)
user_route.get('/paymentCallBack', (req, res) => {
    return res.send({ status: true })
})
module.exports = user_route