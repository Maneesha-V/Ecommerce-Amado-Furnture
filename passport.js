const passport = require("passport")
const GoogleStrategy = require("passport-google-oauth2").Strategy
const User = require("./models/userModel")
const dotenv = require("dotenv").config()
passport.serializeUser((user, done) => {
    done(null, user.id)
})
passport.deserializeUser((id, done) => {
    User.findById(id).then(user => {
        done(null, user)
    }).catch(err => {
        done(err, null)
    })

})
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback",
    passReqToCallback: true
},
    async (request, accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ googleId: profile.id })
            if (user) {
                return done(null, user)
            } else {
                user = new User({
                    firstname: profile.given_name,
                    lastname: profile.family_name,
                    email: profile.emails[0].value,
                    googleId: profile.id
                })
                await user.save()
                return done(null, user)
            }
        }
        catch (err) {
            return done(err, null)
        }
    }))
