require("dotenv").config();
const cloudinary = require("../utils/cloudinary.config");
const fs = require("fs");
const prisma = require("../utils/prismaClient");

const postsGet = async (req, res) => {
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
};

const postsPost = async (req, res) => {
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
};

const singlePostGet = async (req, res) => {
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
};

const singlePostPut = async (req, res) => {
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
};

const singlePostDelete = async (req, res) => {
  const postId = req.params.id;

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    if (post.userId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Unauthorized to delete this post." });
    }

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
};

const profilePostsGet = async (req, res) => {
  const userId = req.params.userId;
  try {
    const userPosts = await prisma.post.findMany({
      where: { userId: userId },
    });
    res.json(userPosts);
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = {
  postsGet,
  postsPost,
  singlePostGet,
  singlePostPut,
  singlePostDelete,
  profilePostsGet,
};
