const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getConversations,
  getMessagesBetweenUsers,
} = require("../controllers/messageController");
const { userAuth } = require("../utils/Auth");

router.post("/send", userAuth, sendMessage);
router.get("/conversations", userAuth, getConversations);
router.get("/conversation/:userId", userAuth, getMessagesBetweenUsers);

module.exports = router;
