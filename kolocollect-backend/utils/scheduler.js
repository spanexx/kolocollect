// scheduler.js

const cron = require('node-cron');
const Community = require('../models/Community'); // Adjust path if needed

const schedulePayouts = () => {
  // Schedule the payout distribution task to run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // Find communities ready for payout
      const communities = await Community.find({
        nextPayout: { $lte: now },
        'midCycle.isComplete': false,
      });

      for (const community of communities) {
        console.log(`Processing payout for community: ${community.name}`);

        try {
          // Call the distributePayouts method
          const result = await community.distributePayouts();
          console.log(result.message);

          // Update next payout info
          await community.updatePayoutInfo();
        } catch (err) {
          console.error(`Error distributing payout for community ${community.name}:`, err);
        }
      }
    } catch (err) {
      console.error('Error in payout scheduler:', err);
    }
  });

  console.log('Scheduler initialized.');
};

module.exports = schedulePayouts;
