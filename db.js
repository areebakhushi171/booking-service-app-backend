
const { Pool } = require("pg");

const pool = new Pool({
    host: "localhost",
    port: 5432,
    user: "softlinks",
    database: "bookease_db"
});

pool.on("connect", () => {
    console.log("Connected to BookEase PostgreSQL database!");
});

pool.on("error", (error) => {
    console.error("Unexpected database error:", error);
});

module.exports = pool;
