// const mongoose = require("mongoose");

// mongoose.connect("mongodb://127.0.0.1:27017/pricePelican")
//     .then(() => console.log("MongoDB connected"))
//     .catch(err => console.log("MongoDB connection error:", err));

// module.exports = mongoose;


require("dotenv").config(); // Load environment variables
const mongoose = require("mongoose");

// ✅ Get MongoDB URI from .env
const uri = process.env.MONGO_URI;

mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("✅ MongoDB Connected Successfully!");
}).catch(err => {
    console.error("❌ MongoDB Connection Error:", err);
});

module.exports = mongoose;

