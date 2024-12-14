require('dotenv').config(); 
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Wallet = require('./models/Wallet');
const Community = require('./models/Community');

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('MongoDB connected');
}).catch((err) => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
});

// Seed users with their wallets and communities
const seedUsers = async () => {
    try {
        // Clear existing data
        await User.deleteMany({});
        await Wallet.deleteMany({});
        console.log('Existing users and wallets cleared');

        // Create sample users
        const users = [
            {
                name: 'John Doe',
                email: 'john@example.com',
                password: bcrypt.hashSync('password123', 10),
                role: 'admin',
                communities: [],
                contributions: []
            },
            {
                name: 'Jane Smith',
                email: 'jane@example.com',
                password: bcrypt.hashSync('password123', 10),
                role: 'user',
                communities: [],
                contributions: []
            }
        ];

        for (const userData of users) {
            const user = new User(userData);
            const savedUser = await user.save();

            // Create wallet for the user with initial balance
            await Wallet.create({
                userId: savedUser._id,
                availableBalance: 1000,  // Set the initial balance
                fixedBalance: 0,
                transactions: [
                    { amount: 1000, type: 'deposit', description: 'Initial deposit' }
                ],
            });

            console.log(`User ${savedUser.name} and wallet created`);
        }
    } catch (err) {
        console.error('Error seeding users and wallets:', err);
    }
};

// Seed community with members and initial cycle
const seedCommunity = async () => {
    try {
        // Clear existing communities
        await Community.deleteMany({});
        console.log('Existing communities cleared');

        // Find users to add as members
        const john = await User.findOne({ email: 'john@example.com' });
        const jane = await User.findOne({ email: 'jane@example.com' });

        if (!john || !jane) {
            console.log('One or both of the admin users not found!');
            return;
        }

        // Create a new community
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
            adminId: john._id,
            membersList: [
                { userId: john._id, name: john.name, email: john.email, position: 1, status: 'active' },
                { userId: jane._id, name: jane.name, email: jane.email, position: 2, status: 'active' }
            ],
            contributionList: [],
            currentCycle: 1,
            cycles: [{
                cycleNumber: 1,
                startDate: new Date(),
                endDate: new Date(new Date().setDate(new Date().getDate() + 7)), // 1-week cycle
                contributions: [],
            }],
        });

        await community.save();
        console.log('Sample community seeded successfully!');
    } catch (err) {
        console.error('Error seeding community:', err);
    }
};

// Seed wallets with initial balance and seed community
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

// Initialize seeding process
const initializeSeeding = async () => {
    await seedUsers();
    await seedCommunity();
    mongoose.disconnect();
};

// Run seeding
initializeSeeding().then(() => {
    console.log('Seeding completed');
}).catch((err) => {
    console.error('Error during seeding:', err);
    mongoose.disconnect();
});
