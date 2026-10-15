/**
 * Cross-check script for trusted device cookie flow (no secrets in output).
 * Run: node test/trusted-device-crosscheck.js
 * Optional HTTP checks: node test/trusted-device-crosscheck.js --http
 */
"use strict";

const crypto = require("crypto");
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const TrustedDeviceService = require("../api/services/trusted-device-service");

function sha256(val) {
    return crypto.createHash("sha256").update(val).digest("hex");
}

function section(title) {
    console.log(`\n=== ${title} ===`);
}

let passed = 0;
let failed = 0;

function ok(name, fn) {
    try {
        fn();
        console.log(`  OK  ${name}`);
        passed++;
    } catch (e) {
        console.log(`  FAIL ${name}: ${e.message}`);
        failed++;
    }
}

section("Unit: generateDeviceToken / sha256");
ok("rawToken is 64 hex chars", () => {
    const { rawToken } = TrustedDeviceService.generateDeviceToken();
    assert.match(rawToken, /^[a-f0-9]{64}$/);
});
ok("tokenHash matches sha256(rawToken)", () => {
    const { rawToken, tokenHash } = TrustedDeviceService.generateDeviceToken();
    assert.strictEqual(tokenHash, sha256(rawToken));
});
ok("exported sha256 matches local", () => {
    const v = "test-device-token-value";
    assert.strictEqual(TrustedDeviceService.sha256(v), sha256(v));
});
ok("two tokens are unique", () => {
    const a = TrustedDeviceService.generateDeviceToken().rawToken;
    const b = TrustedDeviceService.generateDeviceToken().rawToken;
    assert.notStrictEqual(a, b);
});

section("Static: controller exports (source scan)");
const userControllerSrc = fs.readFileSync(
    path.join(__dirname, "../api/v1/controllers/user/index.js"),
    "utf8"
);
const requiredHandlers = ["loginCEO", "loginCEOGet", "loginCEOVerifyOtp", "checkDevice", "logout"];
for (const h of requiredHandlers) {
    ok(`module.exports includes ${h}`, () => {
        assert(userControllerSrc.includes(h), `missing handler ${h}`);
    });
}

section("Static: validation schemas");
const UserValidationV1 = require("../api/v1/validation/user/index");
ok("loginCEO has no required otp", () => {
    const { error } = UserValidationV1.loginCEO.validate({ email: "a@b.com", password: "secret12" });
    assert.ifError(error);
});
ok("loginCEO rejects missing password", () => {
    const { error } = UserValidationV1.loginCEO.validate({ email: "a@b.com" });
    assert(error);
});
ok("loginCEOVerifyOtp requires otp", () => {
    const { error } = UserValidationV1.loginCEOVerifyOtp.validate({
        email: "a@b.com",
        password: "secret12",
        rememberDevice: true
    });
    assert(error);
});
ok("loginCEOVerifyOtp accepts rememberDevice", () => {
    const { error } = UserValidationV1.loginCEOVerifyOtp.validate({
        email: "a@b.com",
        password: "secret12",
        otp: "123456",
        rememberDevice: true
    });
    assert.ifError(error);
});

section("Static: routes wired");
const userRoutesSrc = fs.readFileSync(path.join(__dirname, "../api/v1/routes/user/index.js"), "utf8");
const authRoutesSrc = fs.readFileSync(path.join(__dirname, "../api/v1/routes/auth/index.js"), "utf8");
const v1RoutesSrc = fs.readFileSync(path.join(__dirname, "../api/v1/routes/index.js"), "utf8");
ok("GET /loginCEO route", () => assert(userRoutesSrc.includes('get("/loginCEO"')));
ok("POST /loginCEO/verify-otp route", () => assert(userRoutesSrc.includes('post("/loginCEO/verify-otp"')));
ok("POST /logout route", () => assert(userRoutesSrc.includes('post("/logout"')));
ok("GET /auth/check-device route", () => assert(authRoutesSrc.includes('get("/check-device"')));
ok("v1 mounts /auth", () => assert(v1RoutesSrc.includes("'/auth'")));

section("Static: app middleware");
const appSrc = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
ok("cookie-parser registered in app.js", () => {
    assert(appSrc.includes("cookie-parser") || appSrc.includes("cookieParser"));
});
ok("CORS credentials enabled", () => {
    assert(appSrc.includes("credentials: true"));
});

section("Spec compliance (source)");
const serviceSrc = fs.readFileSync(
    path.join(__dirname, "../api/services/trusted-device-service.js"),
    "utf8"
);
ok("lookup uses fingerprint column only (no IP/UA in WHERE)", () => {
    const whereBlock = serviceSrc.match(/isTrustedDevice[\s\S]*?return rows\[0\]/);
    assert(whereBlock, "isTrustedDevice block not found");
    assert(!/ip_address|user_agent/.test(whereBlock[0].split("WHERE")[1] || ""), "IP/UA used in trust lookup");
});
ok("trustDevice revokes before insert", () => {
    assert(serviceSrc.includes("revokeAllDevicesForUser(userId)"));
    const trustFn = serviceSrc.match(/async function trustDevice[\s\S]*?^}/m);
    assert(trustFn && trustFn[0].indexOf("revokeAllDevicesForUser") < trustFn[0].indexOf("INSERT"));
});
ok("controller never logs rawToken", () => {
    assert(!userControllerSrc.includes("logger") || !userControllerSrc.match(/logger\.[^(]+\([^)]*rawToken/));
});
ok("cookie only set after rememberDevice on verify-otp", () => {
    assert(
        userControllerSrc.includes("isRememberDeviceRequested(rememberDevice)") ||
            userControllerSrc.includes("rememberDevice === true")
    );
    assert(userControllerSrc.includes("res.cookie(DEVICE_COOKIE_NAME, rawToken"));
    const cookieCalls = (userControllerSrc.match(/res\.cookie\(DEVICE_COOKIE_NAME/g) || []).length;
    assert.strictEqual(cookieCalls, 1, `expected 1 res.cookie for device_token, found ${cookieCalls}`);
});

async function httpChecks() {
    const axios = require("axios");
    const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
    const client = axios.create({ baseURL: base, validateStatus: () => true, withCredentials: true });

    section(`HTTP: ${base} (server must be running)`);

    let checkDevice;
    try {
        checkDevice = await client.get("/v1/auth/check-device");
    } catch (e) {
        console.log(`  SKIP HTTP — cannot reach server: ${e.code || e.message}`);
        return;
    }

    ok("GET /v1/auth/check-device returns 200", () => {
        assert.strictEqual(checkDevice.status, 200);
    });
    ok("check-device body has trusted boolean", () => {
        const data = checkDevice.data?.Data ?? checkDevice.data?.data ?? checkDevice.data;
        const trusted = data?.trusted ?? checkDevice.data?.trusted;
        assert.strictEqual(typeof trusted, "boolean");
    });

    const loginGet = await client.get("/v1/user/loginCEO");
    ok("GET /v1/user/loginCEO returns 200 without cookie", () => {
        assert.strictEqual(loginGet.status, 200);
    });

    const loginPost = await client.post("/v1/user/loginCEO", {
        email: "nonexistent-trusted-device-test@example.com",
        password: "wrong-password-xyz"
    });
    ok("POST loginCEO wrong creds returns 400", () => {
        assert.strictEqual(loginPost.status, 400);
    });
}

(async () => {
    if (process.argv.includes("--http")) {
        await httpChecks();
    } else {
        console.log("\nTip: start server (npm run dev) then run with --http for live endpoint checks.");
    }

    console.log(`\n--- Result: ${passed} passed, ${failed} failed ---`);
    process.exit(failed > 0 ? 1 : 0);
})();
