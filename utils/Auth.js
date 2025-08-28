const User = require("../models/User");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const { SECRET, emailAddress } = require("../config");
const sendVerificationEmail = require("./sendVerificationEmail");

/****************************************************************************************************
REGISTRATION AUTHENTICATION => STARTS
 ***************************************************************************************************/
/**
 * @DESC To register the user (ADMIN, USER)
 */

const userRegister = async (userDets, role, res) => {
  try {
    const emailNotRegistered = await validateEmail(userDets.email);
    if (!emailNotRegistered) {
      return res.status(400).json({
        message: `Email is already taken.`,
        success: false,
      });
    }

    const hashedPassword = await bcrypt.hash(userDets.password, 12);
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const newUser = new User({
      ...userDets,
      password: hashedPassword,
      role,
      verificationCode,
      verificationCodeExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    const savedUser = await newUser.save();

    await sendVerificationEmail(savedUser.email, verificationCode);

    const token = jwt.sign(
      {
        _id: savedUser._id,
        role: savedUser.role,
        email: savedUser.email,
      },
      process.env.APP_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      role: savedUser.role,
      _id: savedUser._id,
      email: savedUser.email,
      token: `Bearer ${token}`,
      expiresIn: 168,
      message: "Hurry! now you have successfully registered. Please now login.",
      success: true,
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({
      message: "Unable to create your account, try again later.",
      success: false,
    });
  }
};

/****************************************************************************************************
REGISTRATIONS AUTHENTICATION => ENDS
 ***************************************************************************************************/

/****************************************************************************************************
LOGIN AUTHENTICATION => STARTS
 ***************************************************************************************************/
/**
 * @DESC To login the user (ADMIN, USER)
 */
const userLogin = async (userCreds, res) => {
  const { email, password } = userCreds;

  console.log("user cred", userCreds);

  // Check if the user exists using email only
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({
      message: "User not found. Invalid login credentials.",
      success: false,
    });
  }

  // That means user is existing and trying to signin from the right portal
  //Now check for the password
  let isMatch = await bcrypt.compare(password, user.password);
  if (isMatch) {
    //Sign in the token and issue it to the user
    let token = jwt.sign(
      {
        _id: user._id,
        fullName: user.fullName,
        role: user.role,
        email: user.email || "",
      },
      SECRET,
      { expiresIn: "7 days" }
    );

    let result = {
      role: user.role,
      _id: user._id,
      fullName: user.fullName,
      verified: user.verified,
      email: user.email || "",
      phoneNumber: user.phoneNumber || "",
      package: user.package,
      token: `Bearer ${token}`,
      expiresIn: 168,
    };

    return res.status(200).json({
      ...result,
      message: "Login successful.",
      success: true,
    });
  } else {
    return res.status(403).json({
      message: "Incorrect password",
      success: false,
    });
  }
};
/****************************************************************************************************
LOGIN AUTHENTICATION => ENDS
 ***************************************************************************************************/

/****************************************************************************************************
VALIDATE USERNAME => STARTS
 ***************************************************************************************************/
const validateUsername = async (username) => {
  let user = await User.findOne({ username });
  return user ? false : true;
};

/**
 * @DESC Passport middleware
 */
const userAuth = passport.authenticate("jwt", { session: false });
/****************************************************************************************************
VALIDATE USERNAME => ENDS
 ***************************************************************************************************/

/****************************************************************************************************
ROLES BASED AUTHENTICATION => STARTS
 ***************************************************************************************************/
/**
 * @DESC Check Role Middleware
 */
const checkRole = (roles) => (req, res, next) =>
  !roles.includes(req.user.role)
    ? res.status(401).json("Unauthorized")
    : next();

/****************************************************************************************************
ROLES BASED AUTHENTICATION => ENDS
 ***************************************************************************************************/

/****************************************************************************************************
VALIDATE EMAIL => STARTS
 ***************************************************************************************************/
const validateEmail = async (email) => {
  let user = await User.findOne({ email });
  return user ? false : true;
};
/****************************************************************************************************
VALIDATE EMAIL => ENDS
****************************************************************************************************/

/****************************************************************************************************
SERIALIZE USER => STARTS
 ***************************************************************************************************/
const serializeUser = (user) => {
  return {
    username: user.userName,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    birthday: user.birthday,
    dob: user.dob,
    biography: user.biography,
    address: user.address,
    phoneNumber: user.phoneNumber,
    gender: user.gender,
    followers: user.followers,
    followings: user.followings,
    createdAt: user.createdAt,
    updatedAt: user.createdAt,
    _id: user._id,
  };
};
/****************************************************************************************************
SERIALIZE USER => ENDS
 ***************************************************************************************************/

module.exports = {
  checkRole,
  serializeUser,
  userRegister,
  userLogin,
  userAuth,
};
