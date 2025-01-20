const express          = require('express');
const router           = express.Router();
const passport         = require('passport');
const Account          = require('../models/Account');
const catchAsync       = require('../utils/catchAsync');
const industries       = require('../data/industry');

router.get('/signup', catchAsync(async(req, res) => {
    res.render('./auth/signup', {industries});
}));

router.get('/login', catchAsync(async(req, res) => {
    res.render('./auth/login');
}));

router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/auth/login');
        }
        // Check if the account is verified
        if (!user.verified) {
            req.flash('error', 'Your email is not verified. Please check your inbox for the verification email.');
            return res.redirect('/auth/login');
        }
        // Log the user in
        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            return res.redirect('/app/survey/home');
        });
    })(req, res, next);
});

router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Error during logout:', err);
            req.flash('error', 'Something went wrong during logout.');
            return res.redirect('/auth/login');
        }
        req.flash('success', 'You have been logged out successfully.');
        res.redirect('/auth/login');
    });
});

module.exports = router;