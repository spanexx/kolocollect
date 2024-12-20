const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const contributionRoutes = require('./routes/contributionRoutes');
const communityRoutes = require('./routes/communityRoutes');
const payoutRoutes = require('./routes/payoutRoutes');
const walletRoutes = require('./routes/walletRoutes');
const stripeRoutes = require('./routes/stripeRoutes');
const webhookMiddleware = require('./middlewares/webhookMiddleware');
const schedulePayouts = require('./utils/scheduler'); // Import the scheduler

dotenv.config();

// Initialize express app
const app = express();

// Connect to the database
connectDB();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/communities', communityRoutes);
app.use('/api/contributions', contributionRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/stripe', stripeRoutes);

app.use(
  '/webhook',
  bodyParser.raw({ type: 'application/json' }), // Use raw body for Stripe webhooks
  webhookMiddleware,
  (req, res) => {
    const event = req.stripeEvent;
    console.log(event.type);
    res.sendStatus(200);
  }
);

// Start the scheduler if enabled
if (process.env.ENABLE_SCHEDULER === 'true') {
  schedulePayouts();
}

// Server listen
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
