const express = require("express");
const router = express.Router();
const multer = require("multer");
const authController = require("../controllers/authController");
const { validateSignUp } = require("../utils/validators");
const postController = require("../controllers/postController");
const { authenticateToken } = require("../utils/middleware");

const upload = multer({
  limits: { fileSize: 10485760 },
  dest: "uploads/",
});

router.post("/signup", validateSignUp, authController.signupPost);

router.post("/login", authController.loginPost);

router.get("/posts", postController.postsGet);

router.post(
  "/posts",
  authenticateToken,
  upload.single("fileupload"),
  postController.postsPost
);

router.get("/post/:id", postController.singlePostGet);

router.put(
  "/post/:id",
  authenticateToken,
  upload.single("fileupload"),
  postController.singlePostPut
);

router.delete("/post/:id", authenticateToken, postController.singlePostDelete);

router.get("/profile/:userId", postController.profilePostsGet);

module.exports = router;
