const User = require('../../models/userModel')
const bcrypt = require("bcrypt")
const nodemailer = require("nodemailer")
const jwt = require('jsonwebtoken');

//login
const loadLogin = async (req, res) => {
    try {
        res.render('login', { message: null })
    }
    catch (err) {
        console.error("Error loading login page:", err);
        res.status(500).render('error', { message: "Error loading login page" });
    }
}
const loginUser = async (req, res) => {
    try {
        const email = req.body.email
        const password = req.body.password
        const userData = await User.findOne({ email: email })
        console.log("user",userData);
        
        if (userData) {
            if(userData.is_block == true){
                return res.render('error', { message: "Your access is restricted" })
            }
            const passwordMatch = await bcrypt.compare(password, userData.password)
            if (passwordMatch) {
                req.session.user_id = userData._id
                res.redirect('/home')
            }
            else {
                return res.render('login', { message: "Verify your email and password" })
            }
        }
        else {
            return res.render('login', { message: "Email and password are incorrect" })
        }
    }
    catch (err) {
        console.log(err);
        return res.render('login', { message: "An error occurred, please try again" });
    }
}
const successGoogleLogin = async (req, res) => {
    try {
        console.log(req.user);

        if (!req.user) {
            return res.redirect('/failure');
        }

        const userData = await User.findOne({ email: req.user.email });
        console.log("user-google",userData);
        
        if (!userData) {
            console.error("User not found in the database.");
            return res.render('error', { message: "User not found in the database." });
        }
        if (userData.is_block) {
            return res.render('error', { message: "Your access is restricted.", title: "Access Restricted" });
        }

        req.session.user_id = userData._id;
        res.redirect('/home');
    } catch (err) {
        console.error("Error during Google login:", err);
        // Handle different types of errors
        if (err.code === 11000) { // MongoDB duplicate key error code
            res.status(400).render('404', { status: 404, message: 'This email is already registered. Please log in.' });
        } else {
            res.status(500).render('500', { status: 500, message: 'An error occurred during Google login. Please try again later.' });
        }
    }
};
const failureGoogleLogin = (req, res) => {
    res.redirect('/login');
};
//signup
const loadSignup = async (req, res) => {
    try {
        res.render('signup')
    }
    catch (err) {
        console.error("Error rendering signup page:", err);
        res.status(500).render('error', {
            status: 500,
            message: "An error occurred while loading the signup page. Please try again later."
        });
    }
}
const insertUser = async (req, res) => {
    try {
        const { firstname, lastname, email, password } = req.body
        const mobile = Number(req.body.mobile)
        const user = {
            firstname,
            lastname,
            mobile: mobile,
            email,
            password
        };
        const errors = await validateUser(user)
        if (Object.keys(errors).length > 0) {
            console.log('Validation errors occurred:', errors);
            return res.render('signup', { errors: errors, message: "Registration Failed", formData: req.body })
        }
        const otp = generateOTP()
        console.log(otp);

        const emailSent = await sendVerificationEmail(email, otp)
        if (!emailSent) {
            res.json("Email error")
        }
        req.session.otp = otp
        req.session.userData = { firstname, lastname, mobile, email, password }
        res.redirect('/verify-otp')

    }
    catch (err) {
        console.log(err);
        res.json({ errors: { general: "Something went wrong" }, message: "Registration Failed" })
    }
}
const validateUser = async (user) => {
    const errors = {}
    const nameRegex = /^[a-zA-Z]+$/;
    const mobileRegex = /^\d{10}$/;
    // const dobRegex = /^\d{2}-\d{2}-\d{4}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordPattern = /^(?=.*[a-z])(?=.*\d)[a-z\d]{4,8}$/;

    if (!nameRegex.test(user.firstname)) {
        errors.firstname = 'First name must contain only alphabets without spaces';
    } else if (user.firstname.length < 5 || user.firstname.length > 12) {
        errors.firstname = 'First name must be between 5 and 12 characters';
    } else if (!user.firstname) {
        errors.firstname = 'First name is required'
    }

    if (!nameRegex.test(user.lastname)) {
        errors.lastname = 'Last name must contain only alphabets without spaces';
    } else if (user.lastname.length < 1 || user.lastname.length > 12) {
        errors.lastname = 'Last name must be less than 12 characters';
    } else if (!user.lastname) {
        errors.lastname = 'Last name is required'
    }

    if (!mobileRegex.test(user.mobile)) {
        errors.mobile = 'Mobile number must be exactly 10 digits';
    } else {
        const existingMobile = await User.findOne({ mobile: user.mobile })
        if (existingMobile) {
            errors.mobile = 'Mobile number already exists'
        }
    }
    if (!emailRegex.test(user.email)) {
        errors.email = 'Email format is invalid';
    } else {
        const existingEmail = await User.findOne({ email: user.email })
        if (existingEmail) {
            errors.email = 'Email already exists';
        }
    }
    if (!passwordPattern.test(user.password)) {
        errors.password = 'Password must be 4-8 characters long and include at least one lowercase letter and one number'
    } else if (!user.password) {
        errors.password = 'Password is required'
    }
    return errors
}
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}
const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        })
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP is ${otp}</b>`
        })
        return info.accepted.length > 0
    }
    catch (err) {
        console.log("Error sending email", err)
    }
}
const securePassword = async (password) => {
    try {
        const hashPassword = await bcrypt.hash(password, 10)
        return hashPassword
    }
    catch (err) {
        console.log(err);
    }
}
//forget
const loadForgetPassword = async (req, res) => {
    try {
        res.render('forget-password')
    }
    catch (err) {
        console.error("Error loading forget password page:", err);
        res.status(500).render('error', {
            title: "Error",
            message: "An error occurred while trying to load the forget password page. Please try again later."
        });
    }
}
const forgetPassword = async (req, res) => {
    console.log(req.body);
    try {
        const { email } = req.body
        const user = await User.findOne({ email: email })
        if (!user) {
            return res.render('forget-password', { message: "Email does not exist for this user" })
        }
        const secret = process.env.JWT_SECRET + user.password
        const payload = {
            email: user.email,
            id: user._id
        }
        const token = jwt.sign(payload, secret, { expiresIn: '10m' })
        const resetLink = `http://localhost:3000/reset-password/${user._id}/${token}`;
        console.log(resetLink);

        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Password Reset',
            html: `
            <p>You requested to reset your password. Please click the button below to reset your password:</p>
            <a href="${resetLink}" style="text-decoration: none;">
                <button style="background-color: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                    Reset Password
                </button>
            </a>
            <p>If you did not request this, please ignore this email.</p>
        `
            // text: `You requested to reset your password. Please click the link to reset your password: ${resetLink}`
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log(error);
            }
            console.log('Email sent: ' + info.response);
        });

        res.render('forget-password', { message: "Password reset link sent to your email." })
    }
    catch (err) {
        console.error("Error in forgetPassword:", err);
        res.status(500).render('500', { status: 500, message: "Something went wrong. Please try again later." });
    }
}
//reset-password
const getResetPassword = async (req, res) => {
    const { userId, token } = req.params
    try {
        const user = await User.findById(userId)
        console.log(user);
        if (!user) {
            return res.render('reset-password', {
                message: "Invalid user.",
                token,
                userId
            });
        }
        const secret = process.env.JWT_SECRET + user.password;
        const payload = jwt.verify(token, secret);
        res.render('reset-password', { email: user.email, token, userId, message: null });
    }
    catch (err) {
        console.error("Error in getResetPassword:", err);
        if (err.name === 'JsonWebTokenError') {
            return res.render('reset-password', {
                message: "Invalid or expired token.",
                token,
                userId
            });
        }
        // Handle any other potential errors
        res.status(500).render('500', {
            status: 500,
            message: "Something went wrong. Please try again later."
        });
    }
}
const resetPassword = async (req, res) => {
    // console.log(req.body);   
    const { userId, token } = req.params;
    const { password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
        res.render('reset-password', {
            message: "Passwords do not match.",
            userId, token
        });
    }
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.render('reset-password', {
                message: "Invalid user.",
                userId, token
            });
        }
        const secret = process.env.JWT_SECRET + user.password
        const payload = jwt.verify(token, secret)
        user.password = await securePassword(password)
        await user.save()
        res.render('reset-password', {
            message: "Password has been reset successfully.",
            userId, token
        });
    }
    catch (err) {
        console.log(err);
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.render('reset-password', {
                message: "Invalid or expired token.",
                userId,
                token
            });
        } else {
            res.status(500).render('500', {
                status: 500,
                message: "Something went wrong. Please try again later."
            });
        }
    }
}
//otp
const loadOtpSignUP = async (req, res) => {
    try {
        res.render("otpSignup")
    }
    catch (err) {
        console.error("Error occurred while loading the OTP Signup page:", err);
        res.status(500).render('500', {
            status: 500,
            message: "Something went wrong while loading the OTP signup page. Please try again later."
        });
    }
}
// const verifyOTP = async (req, res) => {
//     try {
//         const { otp } = req.body
//         if (!req.session.otp || !req.session.userData) {
//             return res.status(400).json({ success: false, message: "Session expired or invalid session data." });
//         }
//         console.log("OTP received:", otp, "Session OTP:", req.session.otp);
//         if (req.session.otp === otp) {
//             const user = req.session.userData
//             const secPassword = await securePassword(user.password)
//             const userData = new User({
//                 firstname: user.firstname,
//                 lastname: user.lastname,
//                 mobile: user.mobile,
//                 email: user.email,
//                 password: secPassword,
//                 is_admin: false
//             })
//             await userData.save()
//             req.session.user_id = userData._id
//             res.json({ success: true, redirectUrl: '/home' })
//         } else {
//             res.status(400).json({ success: false, message: "Invalid OTP please try again" })
//         }
//     }
//     catch (err) {
//         console.error("Error during OTP verification:", err);
//         res.status(500).json({ success: false, message: "An error occurred while verifying the OTP. Please try again later." });
//     }
// }
const verifyOTP = async (req, res) => {
    try {
        const { otp } = req.body;

        // Check if the session is valid
        if (!req.session.otp || !req.session.userData) {
            return res.status(400).json({ success: false, message: "Session expired or invalid session data." });
        }

        console.log("OTP received:", otp, "Session OTP:", req.session.otp);
        
        // Validate the OTP
        if (req.session.otp === otp) {
            const user = req.session.userData;

            // Check for an existing user by email
            const existingUser = await User.findOne({ email: user.email });
            if (existingUser) {
                // Handle case where the user already exists
                return res.status(400).json({ success: false, message: "User already exists. Please log in." });
            }

            // Hash the password securely
            const secPassword = await securePassword(user.password);
            
            // Create a new user instance
            const userData = new User({
                firstname: user.firstname,
                lastname: user.lastname,
                mobile: user.mobile,
                email: user.email,
                password: secPassword,
                is_admin: false,
                googleId: user.googleId || undefined , 
            });

            // Save the new user to the database
            await userData.save();
            req.session.user_id = userData._id; // Store user ID in session
            res.json({ success: true, redirectUrl: '/home' });
        } else {
            // Invalid OTP
            res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
        }
    } catch (err) {
        console.error("Error during OTP verification:", err);
        res.status(500).json({ success: false, message: "An error occurred while verifying the OTP. Please try again later." });
    }
}

const resendOTP = async (req, res) => {
    try {
        const { email } = req.session.userData
        console.log(email);
        if (!email) {
            return res.status(400).json({ status: false, message: "Email not found in session" })
        }
        const otp = generateOTP()
        console.log(otp);
        req.session.otp = otp
        const emailSent = await sendVerificationEmail(email, otp)
        if (emailSent) {
            console.log("Resend otp", otp)
            return res.status(200).json({ status: true, message: "OTP Resend Successfully" })
        } else {
            return res.status(500).json({ status: false, message: "Failed to resend OTP Try again" })
        }
    }
    catch (err) {
        console.log(err);
    }
}
//logout
const loadLogout = async (req, res) => {
    try {
        res.render('logout')
    }
    catch (err) {
        console.log(err)
        res.status(500).render('500', { message: "Server error." });
    }
}
const exitLogout = async (req, res) => {
    try {
        req.session.destroy(err => {
            if (err) {
                console.log("Error destroying session:", err);
                return res.status(500).render('500', { message: "Failed to log out." });
            }
            // Optionally, clear the session ID in the cookie (if applicable)
            res.clearCookie('connect.sid'); // Adjust the cookie name if it's different
            res.redirect('/'); // Redirect to the home page or login page
        });
    } catch (err) {
        console.log(err);
        res.status(500).render('500', { message: "Server error." });
    }
};

module.exports = {
    loadLogin, loginUser, loadLogout, exitLogout, successGoogleLogin, failureGoogleLogin,
    loadSignup, insertUser, loadForgetPassword, forgetPassword, getResetPassword, resetPassword,
    loadOtpSignUP, verifyOTP, resendOTP
}