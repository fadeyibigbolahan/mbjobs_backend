// controllers/message.controller.js
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const User = require("../models/User");

// Send a new message
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    const io = req.app.get("io");
    const senderId = req.user._id;

    // Validate input
    if (!senderId || !receiverId || !content) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if recipient exists and isn't blocked
    const recipient = await User.findById(receiverId);
    if (!recipient) {
      return res.status(404).json({ error: "Recipient not found" });
    }

    if (recipient.blockedUsers?.includes(senderId)) {
      return res.status(403).json({ error: "You are blocked by this user" });
    }

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
      });

      // Add conversation to both users
      await User.updateMany(
        { _id: { $in: [senderId, receiverId] } },
        { $push: { conversations: conversation._id } }
      );
    }

    // Create message
    let message = await Message.create({
      conversation: conversation._id,
      sender: senderId,
      content,
      read: false,
    });

    // ✅ Populate sender info (fullName, profileImage, etc.)
    message = await message.populate("sender", "fullName profileImage role");

    // Update conversation
    conversation.lastMessage = message._id;
    await conversation.save();

    // Increment unread count for recipient
    await User.findByIdAndUpdate(receiverId, {
      $inc: { unreadMessages: 1 },
    });

    // Emit real-time events with populated sender
    io.to(receiverId.toString()).emit("newMessage", message);
    io.to(senderId.toString()).emit("messageSent", message);

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error("Message send error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get messages between two users
exports.getMessagesBetweenUsers = async (req, res) => {
  try {
    const { userId } = req.params; // other user
    const currentUserId = req.user._id;

    // Find the conversation between the two users
    const conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, userId] },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Get all messages in the conversation
    const messages = await Message.find({ conversation: conversation._id })
      .sort("createdAt")
      .populate("sender", "fullName profileImage");

    // Mark unread messages sent by the other user as read
    await Message.updateMany(
      {
        conversation: conversation._id,
        sender: { $ne: currentUserId },
        read: false,
      },
      { $set: { read: true, readAt: new Date() } }
    );

    res.json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all conversations for a user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("Fetching conversations for user:", userId);

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "fullName profileImage role")
      .populate("lastMessage")
      .sort("-updatedAt");
    console.log("Conversations fetched:", conversations);

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get messages in a conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Verify user is part of conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.includes(userId)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Get messages
    const messages = await Message.find({
      $or: [
        { sender: userId, recipient: conversation.participants[1] },
        { sender: conversation.participants[1], recipient: userId },
      ],
    }).sort("createdAt");

    // Mark messages as read
    await Message.updateMany(
      { recipient: userId, isRead: false },
      { $set: { isRead: true } }
    );

    // Reset unread count
    conversation.unreadCount = 0;
    await conversation.save();

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
