require("dotenv").config();
const cors = require("cors");
const express = require("express");
const cookieParser = require("cookie-parser");
const router = require("./routes/api");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://sk-bitsnbytes.netlify.app",
];

if (process.env.NODE_ENV === "development") {
  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
    })
  );
} else {
  app.use(
    cors({
      origin: allowedOrigins,
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    })
  );
}

app.use(express.json());
app.use(cookieParser());

app.options("*", cors());

app.use(router);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Listening"));
