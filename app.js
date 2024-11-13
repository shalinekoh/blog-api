require("dotenv").config();
const cors = require("cors");
const express = require("express");
const cookieParser = require("cookie-parser");
const router = require("./routes/api");

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use(router);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Listening"));
