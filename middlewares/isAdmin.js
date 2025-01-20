const isLoggedIn = (req, res, next) => {
    // Check if the user is authenticated
    if (!req.isAuthenticated()) {
        req.flash('error', 'You must be signed in to access this page');
        return res.redirect(`/auth/login`);
    }

    // Check if the user is an admin
    if (!req.user.isAdmin) {
        req.flash('error', 'You must be an admin to access this page');
        return res.redirect(`/auth/login`);
    }

    next(); // User is authenticated and is an admin; proceed to the next middleware/route
};

module.exports = isLoggedIn;