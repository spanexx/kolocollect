// Join a community
exports.joinCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { userId, name, email } = req.body; // Ensure these fields are included in the request

    // Validate request data
    if (!userId || !name || !email) {
      return res.status(400).json({ message: 'Missing required fields: userId, name, or email.' });
    }

    // Find the community
    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    // Check if the user is already a member
    const isAlreadyMember = community.members.some((member) => member.userId.toString() === userId);
    if (isAlreadyMember) {
      return res.status(400).json({ message: 'User is already a member of the community.' });
    }

    // Determine user status based on active mid-cycle
    const activeMidCycle = community.midCycle.find((mc) => !mc.isComplete);
    const status = activeMidCycle ? 'waiting' : 'active';

    // Add the user to the community
    community.members.push({
      userId,
      name,
      email,
      position: null,
      status,
      penalty: 0,
    });

    // Save the updated community
    await community.save();

    // Update the user's community list
    const user = await User.findById(userId);
    if (user) {
      const message = activeMidCycle
        ? `You have joined the community "${community.name}". You will participate in the next cycle.`
        : `You have successfully joined the community "${community.name}".`;

      await user.addNotification('info', message, communityId);
      user.communities.push(communityId);
      await user.save();
    }

    res.status(200).json({ message: 'Successfully joined the community', community });
  } catch (err) {
    console.error('Error in joinCommunity:', err);
    res.status(500).json({ message: 'Error joining community.', error: err.message });
  }
};

lets modify the join community. 
this line '    const status = activeMidCycle ? 'waiting' : 'active'; '
happens only when the community.cycles.cycleNumber = 1,
if its more than one lets 