require("dotenv").config();
const cors = require("cors");
const express = require("express");
const { body, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const cloudinary = require("./utils/cloudinary.config");
const fs = require("fs");

const upload = multer({
  limits: { fileSize: 10485760 },
  dest: "uploads/",
});

const prisma = new PrismaClient();

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

const validateSignUp = [
  body("username")
    .trim()
    .isLength({ min: 5 })
    .withMessage("Username must be at least 5 characters.")
    .custom(async (value) => {
      const user = await prisma.user.findUnique({
        where: { username: value },
      });
      if (user) {
        throw new Error("Username already taken.");
      }
      return true;
    }),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters."),
];

app.post("/signup", validateSignUp, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        username: username,
        password: hashedPassword,
      },
    });
    res.json({ message: "Signup successful", requestData: newUser });
  } catch (error) {
    console.log("Error creating user", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await prisma.user.findFirst({
      where: { username: username },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Incorrect password." });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.MY_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, { httpOnly: true });
    return res.json({ messsage: "Login successful. ", token, id: user.id });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token not provided." });
  }

  jwt.verify(token, process.env.MY_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token." });
    }
    req.user = user;
    next();
  });
}

app.get("/posts", async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      include: {
        User: {
          select: { username: true },
        },
      },
    });

    const randomPosts = posts.sort(() => Math.random() - 0.5).slice(0, 3);
    res.json({ posts: posts, randomPosts: randomPosts });
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
  }
});

app.post(
  "/posts",
  authenticateToken,
  upload.single("fileupload"),
  async (req, res) => {
    const { title, description, content } = req.body;
    const imagePath = req.file ? req.file.path : null;

    let imageUrl = null;
    if (imagePath) {
      const uploadResult = await cloudinary.uploader.upload(imagePath, {
        resource_type: "auto",
      });
      imageUrl = uploadResult.secure_url;
      fs.unlinkSync(imagePath);
    }

    try {
      const post = await prisma.post.create({
        data: {
          title: title,
          description: description,
          content: content,
          image: imageUrl,
          comment: {},
          userId: req.user.id,
        },
      });

      res.status(200).json({ message: "Post successfully created", post });
    } catch (error) {
      res.status(500).json({ message: "Internal server error. " });
    }
  }
);

app.get("/post/:id", async (req, res) => {
  const postId = req.params.id;
  try {
    const post = await prisma.post.findFirst({
      where: { id: postId },
      include: {
        User: {
          select: { username: true },
        },
      },
    });
    res.json(post);
  } catch (error) {
    res.status(401).json({ message: "Post not found. " });
  }
});

app.put(
  "/post/:id",
  authenticateToken,
  upload.single("fileupload"),
  async (req, res) => {
    const { title, description, content } = req.body;
    const postId = req.params.id;
    const imagePath = req.file ? req.file.path : null;
    let imageUrl = null;

    try {
      if (imagePath) {
        const uploadResult = await cloudinary.uploader.upload(imagePath, {
          resource_type: "auto",
        });
        imageUrl = uploadResult.secure_url;
        fs.unlinkSync(imagePath);
      }

      const updatedData = {
        title,
        description,
        content,
      };
      if (imageUrl) {
        updatedData.image = imageUrl;
      }

      const post = await prisma.post.update({
        where: { id: postId },
        data: updatedData,
      });

      res.json({ message: "Post updated successfully.", post });
    } catch (error) {
      console.error("Error updating post:", error);
      res.status(500).json({
        message: "An error occurred while updating the post. Please try again.",
      });
    }
  }
);

app.delete("/post/:id", authenticateToken, async (req, res) => {
  const postId = req.params.id;

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    // Check if the post exists
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    // Optionally, check if the authenticated user is the author of the post
    if (post.userId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Unauthorized to delete this post." });
    }

    // Delete the post
    await prisma.post.delete({
      where: { id: postId },
    });

    res.status(200).json({ message: "Post deleted successfully." });
  } catch (error) {
    console.error("Error deleting post:", error);
    res
      .status(500)
      .json({ message: "An error occurred while deleting the post." });
  }
});

app.get("/profile/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    const userPosts = await prisma.post.findMany({
      where: { userId: userId },
    });
    res.json(userPosts);
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Listening"));
