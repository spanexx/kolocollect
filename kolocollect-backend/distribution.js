// Seeder for testing distributePayouts in Community schema

const mongoose = require('mongoose');
const Community = require('./models/Community'); // Ensure the Community model is correctly imported
require('dotenv').config();

const distributePayoutsSeeder = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Fetch the community with an active mid-cycle that is ready
    const community = await Community.findOne({
      "midCycle.isReady": true,
      "midCycle.isComplete": false,
    });

    if (!community) {
      console.error('No community found with a ready mid-cycle.');
      process.exit(1);
    }

    console.log(`Found Community: ${community.name}`);

    // Attempt to distribute payouts
    try {
      const result = await community.distributePayouts();
      console.log('Payout Distribution Result:', result.message);
    } catch (err) {
      console.error('Error during payout distribution:', err.message);
    }

    process.exit();
  } catch (err) {
    console.error('Error during distributePayoutsSeeder execution:', err.message);
    process.exit(1);
  }
};

distributePayoutsSeeder();
