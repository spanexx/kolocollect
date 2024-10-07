const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Community = require('./kolocollect-backend/models/Community'); // Make sure the path to your model is correct

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

// Define some sample community data
const communities = [
    {
        name: 'Savings Club',
        description: 'A group of friends saving together for a big trip.',
        members: 10,
        contributions: 5000,
        nextPayout: new Date(2024, 1, 20),
        membersList: [
            { name: 'John Doe' },
            { name: 'Jane Smith' },
            { name: 'Sarah Johnson' }
        ]
    },
    {
        name: 'Investment Circle',
        description: 'A community of investors pooling funds for high return investments.',
        members: 25,
        contributions: 15000,
        nextPayout: new Date(2024, 2, 15),
        membersList: [
            { name: 'Alice Brown' },
            { name: 'Mark White' },
            { name: 'Lucy Green' }
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
