require('dotenv').config({ path: '.env' });
let express = require('express');
const fileUpload = require('express-fileupload');
const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
global.appRoot = path.resolve(__dirname);
let bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const basicAuth = require('express-basic-auth');
let _ = require('lodash');
const { Kafka, logLevel } = require('kafkajs');
const customCss = fs.readFileSync((process.cwd() + "/swagger.css"), 'utf8');
global._pathconst = require('./api/helpers/constantdata/pathconst.js');
const helmet = require('helmet');
let app = express();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { apiLogger } = require('./api/helpers/request-logger.js');

// Setup axios interceptors for external API logging
const { setupAxiosLogging } = require('./api/helpers/axios-interceptor');
setupAxiosLogging();

//bdo changes starts//
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", "https:", "data:"],
        formAction: ["'self'"],
        imgSrc: ["'self'", "data:"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        upgradeInsecureRequests: [],
      },
    },
    frameguard: { action: 'sameorigin' }, // X-Frame-Options
    noSniff: true,                        // X-Content-Type-Options
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    hidePoweredBy: true,
    dnsPrefetchControl: { allow: false },
    strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true, preload: true },
  })
);

// Use dedicated permissionsPolicy middleware
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    "geolocation=(), microphone=(), camera=(), payment=()"
  );
  next();
});

// 2️⃣ CORS — credentials (cookies) require a reflected Allow-Origin, not "*"
const corsExtraOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const LOCAL_DEV_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
]);

/** Any host equal to ruloans.com or *.ruloans.com (https or http). */
const isRuloansHostOrigin = (origin) => {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:' && protocol !== 'http:') {
      return false;
    }
    const host = hostname.toLowerCase();
    return host === 'ruloans.com' || host.endsWith('.ruloans.com');
  } catch {
    return false;
  }
};

const isCorsOriginAllowed = (origin) => {
  if (!origin) {
    return true;
  }
  if (corsExtraOrigins.includes(origin)) {
    return true;
  }
  if (LOCAL_DEV_ORIGINS.has(origin)) {
    return true;
  }
  return isRuloansHostOrigin(origin);
};

app.use(
  cors({
    origin(origin, callback) {
      if (isCorsOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Device-ID',
      'X-Device-Type',
      'x-device-id',
      'x-device-type',
      'X-Request-Id',
      'x-request-id',
    ],
    credentials: true,
  })
);

app.disable('x-powered-by');
app.enable('trust proxy');
//bdo changes ends//

let showLogs = process.env.SHOW_SEQUELIZE_LOGS == "true" ? true : false;

global._ = _;
let db2;
let db3;
let db6;

//creating global connection for second database (RULOANS DATABASE) [Neeraj Singh]
db6 = new Sequelize(process.env.DATABASE2_NAME, process.env.DATABASE_USER_NAME, process.env.DATABASE_PASSWORD, {
  host: process.env.DATABASE_HOST,
  dialect: process.env.DATABASE_DIALECT,
  timezone: '+05:30',
  logging: showLogs
});

db7 = new Sequelize(process.env.DATABASE_NAME, process.env.DATABASE_USER_NAME, process.env.DATABASE_PASSWORD, {
  host: process.env.DATABASE_HOST,
  dialect: process.env.DATABASE_DIALECT,
  timezone: '+05:30',
  logging: showLogs
});

if (!process.env.DATABASE_HOST_READ) {
  db2 = new Sequelize(process.env.DATABASE2_NAME, process.env.DATABASE_USER_NAME, process.env.DATABASE_PASSWORD, {
    host: process.env.DATABASE_HOST,
    dialect: process.env.DATABASE_DIALECT,
    timezone: '+05:30',
    logging: showLogs
  });

  db3 = new Sequelize(process.env.DATABASE3_NAME, process.env.DATABASE_USER_NAME, process.env.DATABASE_PASSWORD, {
    host: process.env.DATABASE_HOST,
    dialect: process.env.DATABASE_DIALECT,
    timezone: '+05:30',
    logging: showLogs
  });
} else {
  db2 = new Sequelize(process.env.DATABASE2_NAME, null, null, {
    dialect: process.env.DATABASE_DIALECT,
    timezone: '+05:30',
    port: 3306,
    logging: showLogs,
    replication: {
      read: [
        { host: process.env.DATABASE_HOST_READ, username: process.env.DATABASE_USER_NAME_READ, password: process.env.DATABASE_PASSWORD_READ },
        { host: process.env.DATABASE_HOST_READ_1, username: process.env.DATABASE_USER_NAME_READ, password: process.env.DATABASE_PASSWORD_READ },
        { host: process.env.DATABASE_HOST_READ_2, username: process.env.DATABASE_USER_NAME_READ, password: process.env.DATABASE_PASSWORD_READ }
      ],
      write: { host: process.env.DATABASE_HOST, username: process.env.DATABASE_USER_NAME, password: process.env.DATABASE_PASSWORD }
    },
    pool: { // If you want to override the options used for the read/write pool you can do so here
      max: 50,
      idle: 30000
    }
  });
  db3 = new Sequelize(process.env.DATABASE3_NAME, null, null, {
    dialect: process.env.DATABASE_DIALECT,
    timezone: '+05:30',
    port: 3306,
    logging: showLogs,
    replication: {
      read: [
        { host: process.env.DATABASE_HOST_READ, username: process.env.DATABASE_USER_NAME_READ, password: process.env.DATABASE_PASSWORD_READ },
        { host: process.env.DATABASE_HOST_READ_1, username: process.env.DATABASE_USER_NAME_READ, password: process.env.DATABASE_PASSWORD_READ },
        { host: process.env.DATABASE_HOST_READ_2, username: process.env.DATABASE_USER_NAME_READ, password: process.env.DATABASE_PASSWORD_READ }
      ],
      write: { host: process.env.DATABASE_HOST, username: process.env.DATABASE_USER_NAME, password: process.env.DATABASE_PASSWORD }
    },
    pool: { // If you want to override the options used for the read/write pool you can do so here
      max: 50,
      idle: 30000
    },
  });
};

const kafka = new Kafka({
  logLevel: logLevel.INFO,
  clientId: 'notification-service',
  brokers: [process.env.KAFKA_BOOTSTRAP_SERVERS],
  sasl: {
    mechanism: 'plain',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD
  }
});

// Make producer and consumer global
global._producer = kafka.producer();
global._consumer = kafka.consumer({
  groupId: process.env.KAFKA_INSTANT_CLAIM_GROUP_ID,
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxWaitTimeInMs: 5000,

  retry: {
    initialRetryTime: 100,
    retries: Number.MAX_SAFE_INTEGER,  // unlimited retries
    maxRetryTime: 30000,
    factor: 0.2,
    multiplier: 2,
    retryDelayOnFailover: 100,
    retryDelayOnClusterActionTimeout: 100,
    restartOnFailure: async (err) => {
      console.log('Kafka Conumer failure detected:', { message: err.message, type: err.type })
      return true;
    }
  }

});

try {
  db2.authenticate();
  db3.authenticate();
  // db4.authenticate();

  db6.authenticate();
  console.log('Connection has been established successfully.');
} catch (error) {
  console.error('Unable to connect to the database:', error);
};

//export the database 2 globally [Neeraj Singh]
global._db2 = db2;
global._db3 = db3;

//for table RULoans without read replica;
global._db6 = db6;
//for DB CRMTest without read replica
global._db7 = db7;

app.use('/v1/api-docs', swaggerUi.serve, basicAuth({
  users: { 'CRM': 'Welcome07!' },
  challenge: true,
}), swaggerUi.setup(swaggerDocument, { customCss }));

function logAPICalls(req, res, next) {
  const logFilePath = path.join(__dirname, 'api_logs.txt');
  const currentTime = new Date();
  const tenMinutesAgo = new Date(currentTime.getTime() - 10 * 60 * 1000);

  // Log request
  fs.appendFileSync(logFilePath, `[${currentTime.toISOString()}] [Request] ${req.method} ${req.url}\n`);
  fs.appendFileSync(logFilePath, `[${currentTime.toISOString()}] Headers: ${JSON.stringify(req.headers)}\n`);
  fs.appendFileSync(logFilePath, `[${currentTime.toISOString()}] Body: ${JSON.stringify(req.body)}\n`);

  const oldData = fs.readFileSync(logFilePath, 'utf8').split('\n').filter(line => {
    const logTimestamp = line.match(/^\[(.*?)\]/);
    return logTimestamp && new Date(logTimestamp[1]) >= tenMinutesAgo;
  }).join('\n');

  fs.writeFileSync(logFilePath, oldData);

  const oldLogs = fs.readFileSync(logFilePath, 'utf8').split('\n').filter(line => {
    const logTimestamp = line.match(/^\[(.*?)\]/);
    return logTimestamp && new Date(logTimestamp[1]) >= tenMinutesAgo;
  });

  // Log response
  const originalWrite = res.write;
  const originalEnd = res.end;
  const chunks = [];

  res.write = function (chunk) {
    chunks.push(Buffer.from(chunk));
    originalWrite.apply(res, arguments);
  };

  res.end = function (chunk) {
    if (chunk) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString('utf8');
    fs.appendFileSync(logFilePath, `[${currentTime.toISOString()}] [Response] Status: ${res.statusCode}\n`);
    fs.appendFileSync(logFilePath, `Headers: ${JSON.stringify(res.getHeaders())}\n`);
    fs.appendFileSync(logFilePath, `Body: ${body}\n`);
    originalEnd.apply(res, arguments);
  };

  next();
}

// Register middleware to log API calls
// app.use(logAPICalls);
app.use(fileUpload());


app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' })); //handle queryStrings
app.use(bodyParser.json({ limit: '50mb' }))

// app.use(function (req, res, next) {
//   // Mentioning content types;
//   res.setHeader('Content-Type', 'application/json; charset=UTF-8');

//   // Website you wish to allow to connect;
//   res.setHeader('Access-Control-Allow-Origin', '*');

//   // Request methods you wish to allow;
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

//   // Request headers you wish to allow;
//   res.setHeader('Access-Control-Allow-Headers', '*');

//   // Set to true if you need the website to include cookies in the requests sent;
//   // to the API (e.g. in case you use sessions);
//   res.setHeader('Access-Control-Allow-Credentials', true);

//   // Pass to next layer of middleware
//   next();
// });

app.use(apiLogger()); // pass your winston/pino logger

const v1Routes = require(_pathconst.FilesPath.V1Routes);
const v2Routes = require(_pathconst.FilesPath.V2Routes);

app.use('/v1', v1Routes);
app.use('/v2', v2Routes);

// Gateway path for API verify (email links use CRM /verify-email; legacy API URLs still work)
const EmailChangeController = require(_pathconst.ControllersPath.EmailChangeControllerV1);
app.get('/crm/v1/dsa/verifyDsaEmail', EmailChangeController.verifyEmailPublic);

const notFoundResponse = (res, message = ' Invalid Route ') =>
  res.status(404).json({
    meta: { Status: false, Message: message, code: 404 },
    Data: {},
  });

// Unmatched routes (was a broken 2-arg middleware that treated every request as 404)
app.use((req, res) => notFoundResponse(res));

app.use((err, req, res, next) => {
  if (err?.error?.isJoi && err.error.details) {
    const errDetail = err.error.details.map((item) => ({ [item.context.key]: item.message }));
    return res.status(400).json({
      meta: { Status: false, Message: 'Validation error', code: 400 },
      Data: errDetail,
    });
  }
  console.error(err);
  return notFoundResponse(res);
});

app.get("/debug-sentry", function mainHandler(req, res) { throw new Error("My first Sentry error!"); });

// executeRawQuery();
module.exports = app;

