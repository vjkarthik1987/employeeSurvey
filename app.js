const express              = require('express');
const bodyParser           = require('body-parser');
const methodOverride       = require('method-override');
const path                 = require('path');
const ejsMate              = require('ejs-mate');
const session              = require('express-session');
const flash                = require('connect-flash');
const passport             = require('passport');
const catchAsync           = require('./utils/catchAsync');
const Account              = require('./models/Account');
const Article              = require('./models/Article');
const app                  = express();
require('dotenv').config();

// Set up view engine
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

//Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Overriding methods for delete and update
app.use(methodOverride('_method'));

// Session and passport initialization
app.use(session({
    secret: 'your_secret_key',
    resave: false, // Avoid resaving sessions unnecessarily
    saveUninitialized: false, // Avoid saving uninitialized sessions
    cookie: { secure: false }  // If you're not using HTTPS, ensure this is false
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport to use Account model
passport.use(Account.createStrategy());
passport.serializeUser(Account.serializeUser());
passport.deserializeUser(Account.deserializeUser());

// Saving locals
app.use(async (req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currentUser = req.user;
    res.locals.isAdmin = req.user && req.user.isAdmin;
    next();
});

//Importing routes

const authRoute       = require('./routes/auth');
const accountRoute    = require('./routes/account');
const articleRoute    = require('./routes/article');
const adminRoute      = require('./routes/admin');
const thoughtRoute    = require('./routes/thoughts');

const takeSurveyRoute = require('./routes/takeSurvey');
const surveyRoute     = require('./routes/survey');
const accountAdminRoute = require('./routes/accountAdmin');

app.get('/', (req, res) => {
    res.render('./gen/index');
});

app.get('/surveys', catchAsync(async(req, res) => {
    res.render('./gen/survey.ejs');
}));

app.get('/insights', catchAsync(async(req, res) => {
    const articles = await Article.find({}).sort({ date: -1 }).limit(6);
    res.render('./gen/insights', {articles});
}));




app.use('/auth', authRoute);
app.use('/account', accountRoute);
app.use('/admin', adminRoute);
app.use('/admin/article', articleRoute);
app.use('/thoughts', thoughtRoute);

app.use('/app/survey', surveyRoute);
app.use('/app/takeSurvey', takeSurveyRoute);
app.use('/app/accountAdmin', accountAdminRoute)

app.listen(3000, () => {
    console.log('-----------------------------------------------------------')
    console.log('Server started');
});