const systemService = require("../services/systemService");

const health = async (req, res) => {
    try {
        await systemService.checkDatabaseConnection();

        return res.json({
            message: "BookEase database connected successfully!"
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Database connection failed"
        });
    }
};

const getBookEaseUsers = async (req, res) => {
    try {
        const users = await systemService.getBookEaseUsers();

        return res.json({
            message: "Users fetched successfully!",
            users
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Unable to fetch users"
        });
    }
};

module.exports = {
    health,
    getBookEaseUsers
};
