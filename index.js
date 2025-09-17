const express = require("express");
const { success, error } = require("consola");
const { connect } = require("mongoose");
const passport = require("passport");
const { DB, PORT } = require("./config");
const expireOldJobs = require("./cron/expireJobs");

const http = require("http");
const socketio = require("socket.io");
const cors = require("cors");
const webhookRoutes = require("./routes/webhook");

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*", // TODO: restrict to frontend URL in production
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// -------------------- Middlewares --------------------

// ✅ Webhook route must come FIRST (before body parser)
app.use("/webhook", webhookRoutes);

// JSON body parser and passport
app.use(express.json());
app.use(passport.initialize());
require("./middlewares/passport")(passport);

// CORS
app.use(cors({ origin: true, credentials: true }));

// -------------------- Routes --------------------
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/jobs", require("./routes/jobRoutes"));
app.use("/api/application", require("./routes/applicationRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));
app.use("/api/courses", require("./routes/courseRoutes"));
app.use("/api/pricing", require("./routes/pricing"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/subscription", require("./routes/subscription"));
app.use("/api/wioa", require("./routes/WIOARoutes"));

// -------------------- Socket.IO --------------------
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // User joins their room
  socket.on("joinUser", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

  // Real-time messaging
  socket.on("sendMessage", (data) => {
    const { recipientId, message } = data;
    io.to(recipientId).emit("newMessage", message);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Make `io` accessible across routes if needed
app.set("io", io);

// -------------------- Cron --------------------
expireOldJobs();

// -------------------- Start App --------------------
const startApp = async () => {
  try {
    await connect(DB, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    success({
      message: `✅ Successfully connected with the Database \n${DB}`,
      badge: true,
    });

    server.listen(PORT, () =>
      success({ message: `🚀 Server started on PORT ${PORT}`, badge: true })
    );
  } catch (err) {
    error({
      message: `❌ Unable to connect with Database \n${err}`,
      badge: true,
    });
    process.exit(1);
  }
};

startApp();
