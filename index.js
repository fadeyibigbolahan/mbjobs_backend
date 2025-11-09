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

// CORS configuration
const allowedOrigins = [
  "https://virtualkonektions.com",
  "https://www.virtualkonektions.com",
  "http://localhost:3000",
  "http://localhost:5173",
];

// ✅ Apply CORS middleware FIRST, before any routes
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// ✅ Handle preflight requests explicitly
app.options("*", cors());

// ✅ Now add the webhook route (which might need special CORS handling)
app.use("/webhook", webhookRoutes);

// JSON body parser and passport
app.use(express.json());
app.use(passport.initialize());
require("./middlewares/passport")(passport);

// Socket.IO configuration with same CORS
const io = socketio(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

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
app.use("/api/orientation-forms", require("./routes/orientationFormRoutes"));

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
