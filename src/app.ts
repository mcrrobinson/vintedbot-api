import express from 'express';
import db from './models';
import userRoutes from './routes';
import adminRoutes from './routes/admin';
const http = require('http');
const cors = require('cors');
const app = express();
const HOST = process.env.HOST || '0.0.0.0';
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
  'http://portal.vintedbot.co.uk',
  'https://portal.vintedbot.co.uk',
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
app.use('/admin', adminRoutes);

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