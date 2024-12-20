const mongoose = require('mongoose');
const Community = require('./models/Community');
const User = require('./models/User');
const communityController = require('./controllers/communityController');
require('dotenv').config();

const joinCommunitySeeder = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Fetch all users
    const users = await User.find({});
    if (users.length === 0) {
      console.error('No users found. Please seed users first.');
      process.exit(1);
    }

    // Fetch the community
    const communityId = '6765e0f2a1507d9194be574d'; // Replace with your community ID
    const community = await Community.findById(communityId);
    if (!community) {
      console.error('Community not found. Please create the community first.');
      process.exit(1);
    }

    console.log(`Found Community: ${community.name}`);

    // Get a list of existing member user IDs
    const existingMemberIds = community.members.map((member) => member.userId.toString());

    // Filter users who are not already members
    const usersToJoin = users.filter((user) => !existingMemberIds.includes(user._id.toString()));

    // Join each non-member into the community
    for (const user of usersToJoin) {
      const req = {
        params: { communityId },
        body: { userId: user._id },
      };
      const res = {
        status: (statusCode) => ({
          json: (data) => {
            if (statusCode === 200) {
              console.log(`User ${user.name} joined the community successfully.`);
            } else {
              console.error(`Failed to add ${user.name}:`, data.message);
            }
          },
        }),
      };

      try {
        // Use the joinCommunity controller
        await communityController.joinCommunity(req, res);
      } catch (err) {
        console.error(`Error adding user ${user.name}:`, err.message);
      }
    }

    console.log('All eligible users have attempted to join the community.');
    process.exit();
  } catch (err) {
    console.error('Error during joinCommunitySeeder execution:', err.message);
    process.exit(1);
  }
};

joinCommunitySeeder();
