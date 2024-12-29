const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Community = require('./models/Community');
const Wallet = require('./models/Wallet');
const ContributionController = require('./controllers/contributionController');

// Load environment variables
dotenv.config();

const seedContributionForOneMember = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });

    console.log('Connected to MongoDB.');

    // Replace these IDs with the ones you want to use
    const communityId = '677138127871068210c5efb8'; // Update with actual community ID
    const midCycleId = '677139a6f919178d5137e71e'; // Update with actual midCycle ID

    // Fetch the target community
    const community = await Community.findById(communityId);

    if (!community) {
      console.error('Community not found. Verify the community ID.');
      process.exit(1);
    }

    console.log(`Found community: "${community.name}"`);

    // Verify that the midCycleId exists in the community
    const activeMidCycle = community.midCycle.find((mc) => mc._id.toString() === midCycleId && !mc.isComplete);

    if (!activeMidCycle) {
      console.error('MidCycle not active or not found:', midCycleId);
      console.log('Available MidCycles:', community.midCycle.map((mc) => ({
        id: mc._id.toString(),
        isComplete: mc.isComplete,
        isReady: mc.isReady,
      })));
      process.exit(1);
    }

    console.log(`Active mid-cycle found: Cycle ${activeMidCycle.cycleNumber}`);

    // Filter eligible members (active status and no prior contributions in this mid-cycle)
    const eligibleMembers = community.members.filter((member) => {
      const contributions = activeMidCycle.contributors.get(member.userId.toString());
      return member.status === 'active' && (!contributions || contributions.length === 0);
    });

    if (!eligibleMembers.length) {
      console.log('No eligible members found who have not contributed yet.');
      process.exit(0);
    }

    // Select the first eligible member
    const memberToContribute = eligibleMembers[0];
    console.log(`Selected member for contribution: User ID ${memberToContribute.userId}`);

    // Find the member's wallet
    const wallet = await Wallet.findOne({ userId: memberToContribute.userId });

    if (!wallet || wallet.availableBalance < community.settings.minContribution) {
      console.error(`User ${memberToContribute.userId} has insufficient funds or wallet not found.`);
      process.exit(0);
    }

    console.log(`User Wallet Balance: €${wallet.availableBalance}`);
    console.log('Community MidCycle IDs:', community.midCycle.map((mc) => mc._id.toString()));

    // Prepare request and response mocks for ContributionController
    const req = {
      body: {
        userId: memberToContribute.userId,
        communityId,
        amount: community.settings.minContribution, // Minimum contribution
        contributionDate: new Date(),
        cycleNumber: activeMidCycle.cycleNumber,
        midCycleId: activeMidCycle._id,
      },
    };

    const res = {
      status: (code) => ({
        json: (data) => console.log(`Contribution Response: ${data.message}`),
      }),
    };

    try {
      // Call the createContribution method
      await ContributionController.createContribution(req, res);
      console.log('Contribution successfully created.');
    } catch (err) {
      console.error(`Failed to create contribution for user ${memberToContribute.userId}:`, err.message);
    }

    process.exit();
  } catch (err) {
    console.error('Error during contribution seeding:', err.message);
    process.exit(1);
  }
};

seedContributionForOneMember();
