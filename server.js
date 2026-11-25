
const express = require("express");
const http = require("http");
const attachSocketServer = require("./config/socket");

const systemRoutes = require("./routes/systemRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const favoriteRoutes = require("./routes/favoriteRoutes");
const messagingRoutes = require("./routes/messagingRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();

// JSON request receive karne ke liye
app.use(express.json());

// ==========================================
// HOME API
// ==========================================

app.get("/", (req, res) => {
    res.json({
        message: "BookEase Backend is running!"
    });
});

app.use("/api", systemRoutes);

// ==========================================
// BOOKEASE AUTHENTICATION ROUTES
// ==========================================

app.use("/api/auth", authRoutes);

// ==========================================
// BOOKEASE USER PROFILE ROUTES
// ==========================================

app.use("/api/users", userRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/conversations", messagingRoutes);
app.use("/api/notifications", notificationRoutes);

// ==========================================
// START BACKEND
// ==========================================

const server = http.createServer(app);
attachSocketServer(server);

const port = Number(process.env.PORT || 3000);

server.listen(port, () => {
    console.log(`BookEase backend running on port ${port}`);
});
