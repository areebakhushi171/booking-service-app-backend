const test = require("node:test");
const assert = require("node:assert/strict");
const {
    createPropertyValidators,
    updatePropertyValidators
} = require("../validators/propertyValidators");

const validCreateBody = (price) => ({
    name: "Service",
    description: "Service description",
    category: "cleaning",
    price,
    duration: 60,
    country: "Pakistan",
    city: "Karachi"
});

const runValidators = async (validators, body) => {
    const req = { body, params: {}, query: {}, files: {} };
    let statusCode = 200;
    let responseBody;
    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(value) {
            responseBody = value;
            return this;
        }
    };

    for (const validator of validators) {
        if (typeof validator.run === "function") {
            await validator.run(req);
        } else {
            validator(req, res, (error) => {
                if (error) throw error;
            });
        }
    }

    return { statusCode, responseBody, body: req.body };
};

const expectInvalidPrice = async (price) => {
    const result = await runValidators(
        createPropertyValidators,
        validCreateBody(price)
    );
    assert.equal(result.statusCode, 400);
    assert.ok(
        result.responseBody.errors.some((error) =>
            error.message.includes("Price")
        )
    );
};

test("service creation rejects missing, empty, zero, negative, and nonnumeric prices", async () => {
    const missing = validCreateBody(undefined);
    delete missing.price;
    const missingResult = await runValidators(createPropertyValidators, missing);
    assert.equal(missingResult.statusCode, 400);
    assert.ok(
        missingResult.responseBody.errors.some(
            (error) => error.message === "Price is required"
        )
    );

    for (const price of [null, "", "   ", "0", 0, "-1", -1, "invalid", true]) {
        await expectInvalidPrice(price);
    }
});

test("service creation accepts a positive integer or decimal price", async () => {
    const result = await runValidators(
        createPropertyValidators,
        validCreateBody("2500.50")
    );
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.price, 2500.5);
});

test("service update rejects invalid supplied prices but permits other partial updates", async () => {
    const invalid = await runValidators(updatePropertyValidators, {
        name: "Renamed",
        price: 0
    });
    assert.equal(invalid.statusCode, 400);

    const valid = await runValidators(updatePropertyValidators, {
        name: "Renamed",
        price: "2500"
    });
    assert.equal(valid.statusCode, 200);
    assert.equal(valid.body.price, 2500);

    const omitted = await runValidators(updatePropertyValidators, {
        name: "Renamed"
    });
    assert.equal(omitted.statusCode, 200);
});
