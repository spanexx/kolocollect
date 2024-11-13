const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Community = require('./models/Community'); // Make sure the path is correct
const { ObjectId } = mongoose.Types;

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

// Define new community data based on the schema
const communities = [
    {
        name: 'Savings Club',
        description: 'A group of friends saving together for a big trip.',
        members: 10,
        contributions: 5000,
        nextPayout: new Date(2024, 1, 20),
        maxMembers: 20,  // Set maxMembers as required
        contributionFrequency: 'monthly',  // Set contribution frequency as required
        cycleLockEnabled: false,
        backupFund: 1000,
        membersList: [
            { userId: new ObjectId(), name: 'John Doe', email: 'johndoe@example.com' },
            { userId: new ObjectId(), name: 'Jane Smith', email: 'janesmith@example.com' },
            { userId: new ObjectId(), name: 'Sarah Johnson', email: 'sarahjohnson@example.com' }
        ]
    },
    {
        name: 'Investment Circle',
        description: 'A community of investors pooling funds for high return investments.',
        members: 25,
        contributions: 15000,
        nextPayout: new Date(2024, 2, 15),
        maxMembers: 50,  // Set maxMembers as required
        contributionFrequency: 'bi-weekly',  // Set contribution frequency as required
        cycleLockEnabled: true,
        backupFund: 5000,
        membersList: [
            { userId: new ObjectId(), name: 'Alice Brown', email: 'alicebrown@example.com' },
            { userId: new ObjectId(), name: 'Mark White', email: 'markwhite@example.com' },
            { userId: new ObjectId(), name: 'Lucy Green', email: 'lucygreen@example.com' }
        ]
    }
];

// Seed the data into the database
const seedData = async () => {
    try {
        // Clear existing data
        await Community.deleteMany();
        console.log('Existing data cleared');

        // Insert new data
        await Community.insertMany(communities);
        console.log('Data successfully seeded');

        // Exit process
        process.exit();
    } catch (err) {
        console.error('Error seeding data:', err);
        process.exit(1);
    }
};

seedData();
