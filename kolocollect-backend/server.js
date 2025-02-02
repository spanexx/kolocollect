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
const Community = require('./models/Community'); // Update the path as per your project structure
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

// Function to start payout monitors for all communities
const startPayoutMonitoringForAllCommunities = async () => {
  try {
    const communities = await Community.find(); // Fetch all communities
    if (communities.length === 0) {
      console.log('No communities found to monitor payouts.');
      return;
    }

    communities.forEach((community) => {
      community.startPayoutMonitor(); // Start monitoring payouts for each community
      const activeMidCycle = community.midCycle.find(mc => !mc.isComplete);
      const countdown = activeMidCycle ? Math.max(0, new Date(activeMidCycle.payoutDate) - new Date()) : 'N/A';
      const countdownMinutes = countdown !== 'N/A' ? Math.floor(countdown / 60000) : 'N/A';
      console.log(`Payout monitor started for community: ${community.name} CountDown: ${countdownMinutes} mins`);
    });
  } catch (err) {
    console.error('Error starting payout monitors:', err);
  }
};

// Start the scheduler if enabled
if (process.env.ENABLE_SCHEDULER === 'true') {
  schedulePayouts();
}

// Start payout monitoring for communities
startPayoutMonitoringForAllCommunities();

// Server listen
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
