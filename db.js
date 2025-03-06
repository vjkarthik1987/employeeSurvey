// const mongoose = require("mongoose");

// const MONGO_URI = "mongodb://127.0.0.1:27017/employeeSurvey";
// console.log("Connecting to MongoDB:", MONGO_URI);

// mongoose.connect(MONGO_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true
// })
//     .then(() => console.log("MongoDB connected"))
//     .catch(err => console.log("MongoDB connection error:", err));

// module.exports = mongoose;


require("dotenv").config(); // Load environment variables
const mongoose = require("mongoose");
console.log("🔍 Checking Environment Variables...");
console.log("MONGO_URI:", process.env.MONGO_URI || "❌ Not Found!");

// ✅ Get MongoDB URI from .env
const uri = process.env.MONGO_URI;

mongoose.connect(uri).then(() => {
    console.log("✅ MongoDB Connected Successfully!");
}).catch(err => {
    console.error("❌ MongoDB Connection Error:", err);
});

module.exports = mongoose;

