import express from 'express';
import db from './models';
import userRoutes from './routes';
const https = require('https');
const http = require('http');
const cors = require('cors');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 443;
const HOST = process.env.HOST || '0.0.0.0';

const certsPath = './src';
// const certsPath = '/etc/letsencrypt/live/lemontree.zapto.org';
const privKeyPath = `${certsPath}/privkey.pem`;
const certPath = `${certsPath}/cert.pem`;

const options = {
  key: fs.readFileSync(privKeyPath, 'utf8'),
  cert: fs.readFileSync(certPath, 'utf8'),
}

const credentials = { key: options.key, cert: options.cert };
const httpsServer = https.createServer(credentials, app);
const httpServer = http.createServer(app);

// Middleware
app.use(express.json());

app.use(function(req, res, next) {

  try {
      decodeURIComponent(req.path)
  }
  catch(e) {
      console.log(new Date().toLocaleString(), req.url, e);
      return res.redirect('/404'); 
  }
  next(); 
});

const allowedOrigins = [
  'http://vintedbot-frontend-react-app.s3-website.eu-west-2.amazonaws.com',
  'https://vintedbot-frontend-react-app.s3-website.eu-west-2.amazonaws.com',
  'http://d2x3i2yt1wweva.cloudfront.net',
  'https://d2x3i2yt1wweva.cloudfront.net',
  'http://localhost:3000'
];

// Allow all routes
app.use(cors({
    origin: "*",
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allow these HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'] // Allow these headers
}));

// Handle preflight requests for all routes
app.options('*', cors());

// Routes
app.use('/users', userRoutes);

// Test database connection and sync
db.sequelize.authenticate()
  .then(() => {
    console.log('Database connected...');
    return db.sequelize.sync();
  })
  .then(() => {
    console.log('Database synced...');
  })
  .catch((error: Error) => {
    console.error('Unable to connect to the database:', error);
  });

httpServer.listen(80, HOST, () => {
  console.log(`Server is listening at http://${HOST}:80`);
});

httpServer.on('error', (error: any) => {
  console.error('Server error:', error);
});

// Start listening on a specific port and address
httpsServer.listen(PORT, HOST, () => {
  console.log(`Server is listening at https://${HOST}:${PORT}`);
});

// When an error occurs, show it
httpsServer.on('error', (error: any) => {
  console.error('Server error:', error);
});

// Watch for certificate file changes
fs.watchFile(certPath, () => {
  console.log('Certificate file changed, reloading...');

  try {
    let privateKey = fs.readFileSync(privKeyPath, 'utf8');
    let certificate = fs.readFileSync(certPath, 'utf8');

    let credentials = { key: privateKey, cert: certificate };

    httpsServer.setSecureContext(credentials);
    console.log('Certificate reloaded successfully');
  } catch (error) {
    console.error('Error reloading certificate:', error);
  }
});