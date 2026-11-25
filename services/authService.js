const prisma = require("../config/database");
const generateToken = require("../utils/generateToken");
const { comparePassword, hashPassword } = require("../utils/passwordUtils");

const registerUser = async ({
    name,
    email,
    phone,
    password,
    role,
    businessName,
    businessCategory
}) => {
    const existingUser = await prisma.user.findUnique({
        where: { email }
    });

    if (existingUser) {
        return { status: "email-conflict" };
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
        data: {
            name,
            email,
            phone,
            passwordHash,
            role,
            businessName: role === "provider" ? businessName : null,
            businessCategory: role === "provider" ? businessCategory : null
        }
    });

    return {
        status: "created",
        user,
        token: generateToken(user)
    };
};

const loginUser = async ({ email, password }) => {
    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user || !(await comparePassword(password, user.passwordHash))) {
        return { status: "invalid-credentials" };
    }

    return {
        status: "authenticated",
        user,
        token: generateToken(user)
    };
};

module.exports = {
    registerUser,
    loginUser
};
