require('dotenv').config(); // Load environment variables from .env file
const mongoose = require('mongoose');
const Community = require('../kolocollect-backend/models/Community');
const User = require('../kolocollect-backend/models/User');
const Wallet = require('../kolocollect-backend/models/Wallet'); // Ensure this is the correct path for your Wallet model

// Connect to MongoDB using URI from .env file
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected');
}).catch((err) => {
  console.error('MongoDB connection failed:', err);
  process.exit(1);
});

// Function to seed wallet with initial balance
const seedWallet = async (userId, initialBalance) => {
  const wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    await Wallet.create({
      userId,
      availableBalance: initialBalance,
      totalBalance: initialBalance,
    });
  } else {
    wallet.availableBalance = initialBalance;
    wallet.totalBalance = initialBalance;
    await wallet.save();
  }
};

const seedCommunity = async () => {
  try {
    // Delete all existing communities before seeding the new one
    await Community.deleteMany({});

    // Find the admin users (John and Jane) in the database by email
    const john = await User.findOne({ email: 'john@example.com' });
    const jane = await User.findOne({ email: 'jane@example.com' });

    if (!john || !jane) {
      console.log('One or both of the admin users not found! Please add them first.');
      return;
    }

    // Seed wallet for John and Jane with an initial balance (e.g., 1000)
    await seedWallet(john._id, 1000);
    await seedWallet(jane._id, 1000);

    // Create a sample community
    const community = new Community({
      name: 'Sample Community',
      description: 'This is a test community for contributions.',
      maxMembers: 10,
      contributionFrequency: 'Weekly',
      cycleLockEnabled: false,
      backupFund: 0,
      totalContributions: 0,
      nextPayout: new Date(),
      isPrivate: false,
      contributionLimit: 1000,
      adminId: john._id, // Reference to the admin user by _id (John)
      membersList: [
        {
          userId: john._id,
          name: john.name,
          email: john.email,
          position: 1,  // John is the first member
        },
        {
          userId: jane._id,
          name: jane.name,
          email: jane.email,
          position: 2,  // Jane is the second member
        },
      ],
      contributionList: [],
      currentCycle: 1,
      cycles: [{
        cycleNumber: 1,
        startDate: new Date(),
        endDate: new Date(new Date().setDate(new Date().getDate() + 7)), // One week cycle
        contributions: [],
      }],
    });

    await community.save();
    console.log('Sample community seeded successfully!');
  } catch (err) {
    console.error('Error seeding community:', err);
  } finally {
    mongoose.disconnect();
  }
};

// Call the seed function
seedCommunity();
