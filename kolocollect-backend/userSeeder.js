const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Adjust the path as necessary

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

// Define sample user data with role and dateJoined fields
const users = [
    {
        name: 'John Doe',
        email: 'john@example.com',
        password: bcrypt.hashSync('password123', 10),
        role: 'user',
        dateJoined: new Date(),
        communities: [] // Add community IDs if needed
    },
    {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: bcrypt.hashSync('password123', 10),
        role: 'admin',
        dateJoined: new Date(),
        communities: []
    },
    {
        name: 'Alice Brown',
        email: 'alice@example.com',
        password: bcrypt.hashSync('password123', 10),
        role: 'user',
        dateJoined: new Date(),
        communities: []
    },
    {
        name: 'Mark White',
        email: 'mark@example.com',
        password: bcrypt.hashSync('password123', 10),
        role: 'user',
        dateJoined: new Date(),
        communities: []
    },
    {
        name: 'Sarah Johnson',
        email: 'sarah@example.com',
        password: bcrypt.hashSync('password123', 10),
        role: 'admin',
        dateJoined: new Date(),
        communities: []
    },
    {
        name: 'Kennedy',
        email: 'kennedy@example.com',
        password: bcrypt.hashSync('password123', 10),
        role: 'user',
        dateJoined: new Date(),
        communities: []
    },
];

// Seed users into the database
const seedUsers = async () => {
    try {
        // Clear existing users
        await User.deleteMany();
        console.log('Existing users cleared');

        // Insert new users
        await User.insertMany(users);
        console.log('Users successfully seeded');

        // Exit process
        process.exit();
    } catch (err) {
        console.error('Error seeding users:', err);
        process.exit(1);
    }
};

seedUsers();
