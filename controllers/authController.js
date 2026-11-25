const authService = require("../services/authService");

const authResponseUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
    avatarPublicId: user.avatarPublicId,
    businessName: user.businessName,
    businessCategory: user.businessCategory,
    notificationsEnabled: user.notificationsEnabled,
    darkMode: user.darkMode,
    joinedDate: user.createdAt
});

const signup = async (req, res) => {
    try {
        const result = await authService.registerUser(req.body);

        if (result.status === "email-conflict") {
            return res.status(409).json({
                message: "Email address is already registered"
            });
        }

        return res.status(201).json({
            message: "Account created successfully!",
            token: result.token,
            user: authResponseUser(result.user)
        });
    } catch (error) {
        console.error("Signup Error:", error);

        return res.status(500).json({
            message: "Unable to create account"
        });
    }
};

const login = async (req, res) => {
    try {
        const result = await authService.loginUser(req.body);

        if (result.status === "invalid-credentials") {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        return res.status(200).json({
            message: "Login successful!",
            token: result.token,
            user: authResponseUser(result.user)
        });
    } catch (error) {
        console.error("Login Error:", error);

        return res.status(500).json({
            message: "Unable to login"
        });
    }
};

module.exports = {
    signup,
    login
};
