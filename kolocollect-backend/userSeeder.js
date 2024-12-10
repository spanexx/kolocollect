const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Adjust the path as necessary
const Wallet = require('./models/Wallet'); // Include Wallet model

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('MongoDB connected');
}).catch((err) => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
});

// Define sample user data with updated schema fields
const users = [
    {
        name: 'John Doe',
        email: 'john@example.com',
        password: bcrypt.hashSync('password123', 10),
        role: 'user',
        dateJoined: new Date(),
        communities: [],
        totalSavings: 1000,
        upcomingPayout: 200,
        recentActivities: [
            { action: 'joined', details: 'Community A', date: new Date() },
            { action: 'contributed', details: '100 to Community B', date: new Date() },
        ],
        savingsGoals: [
            { goal: 'Buy a car', amount: 5000, progress: 1000 },
            { goal: 'Emergency fund', amount: 2000, progress: 800 },
        ],
    },
    {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: bcrypt.hashSync('password123', 10),
        role: 'admin',
        dateJoined: new Date(),
        communities: [],
        totalSavings: 2000,
        upcomingPayout: 300,
        recentActivities: [
            { action: 'created', details: 'Community X', date: new Date() },
        ],
        savingsGoals: [
            { goal: 'Vacation', amount: 3000, progress: 1500 },
        ],
    },
    // Add more users as needed
];

// Seed users and wallets into the database
const seedUsers = async () => {
    try {
        // Clear existing users and wallets
        await User.deleteMany();
        await Wallet.deleteMany();
        console.log('Existing users and wallets cleared');

        for (const userData of users) {
            // Create user
            const user = new User(userData);
            const savedUser = await user.save();

            // Create associated wallet with initial fixed funds and transactions
            const wallet = new Wallet({
                userId: savedUser._id,
                availableBalance: 0, // Starting with 0 available balance
                totalBalance: 1000,
                fixedBalance: 0, // Starting with 0 fixed balance
                transactions: [
                    // Add some example transactions to the wallet
                    {
                        amount: 1000,
                        type: 'deposit',
                        description: 'Initial deposit',
                    },
                    {
                        amount: 500,
                        type: 'withdrawal',
                        description: 'Withdraw for savings goal',
                    },
                ],
                fixedFunds: [
                    // Add some example fixed funds
                    {
                        amount: 1000,
                        startDate: new Date(),
                        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1 month from now
                        isMatured: false,
                    },
                ],
            });

            await wallet.save();
        }

        console.log('Users and wallets successfully seeded');
        process.exit();
    } catch (err) {
        console.error('Error seeding users and wallets:', err);
        process.exit(1);
    }
};

seedUsers();
