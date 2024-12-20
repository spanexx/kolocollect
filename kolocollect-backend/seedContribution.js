const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Community = require('./models/Community');
const Wallet = require('./models/Wallet');
const ContributionController = require('./controllers/contributionController');

// Load environment variables
dotenv.config();

const seedContributions = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });

    console.log('Connected to MongoDB.');
    console.log('Seeding contributions for eligible community members...');

    // Fetch the target community
    const communityId = '6763c9b70317a02d81322e33';
    const community = await Community.findById(communityId);

    if (!community) {
      console.error('Community not found. Verify the community ID.');
      process.exit(1);
    }

    console.log(`Found community: "${community.name}"`);

    // Fetch the active mid-cycle
    const activeMidCycle = community.midCycle.find((mc) => !mc.isComplete);
    if (!activeMidCycle) {
      console.error('No active mid-cycle found.');
      process.exit(1);
    }

    console.log(`Active mid-cycle found: Cycle ${activeMidCycle.cycleNumber}`);

    // Filter eligible members (active status and valid position)
    const eligibleMembers = community.members.filter(
      (member) => member.position !== null && member.status === 'active'
    );

    if (!eligibleMembers.length) {
      console.log('No eligible members to contribute.');
      process.exit(0);
    }

    console.log(`Found ${eligibleMembers.length} eligible members.`);

    // Process contributions for eligible members
    for (const member of eligibleMembers) {
      const wallet = await Wallet.findOne({ userId: member.userId });

      if (!wallet || wallet.availableBalance < 100) {
        console.warn(`Skipping user ${member.userId} - insufficient funds or wallet not found.`);
        continue;
      }

      // Prepare request and response mocks for ContributionController
      const req = {
        body: {
          userId: member.userId,
          communityId: communityId,
          amount: 100, // Contribution amount
          contributionDate: new Date(),
          cycleNumber: activeMidCycle.cycleNumber,
          midCycleId: activeMidCycle._id,
        },
      };

      const res = {
        status: (code) => ({
          json: (data) => console.log(`User ${member.userId}: ${data.message}`),
        }),
      };

      try {
        // Call the createContribution method
        await ContributionController.createContribution(req, res);
      } catch (err) {
        console.error(`Failed to create contribution for user ${member.userId}:`, err.message);
      }
    }

    console.log('Seeding contributions completed successfully.');
    process.exit();
  } catch (err) {
    console.error('Error during contribution seeding:', err.message);
    process.exit(1);
  }
};

seedContributions();
