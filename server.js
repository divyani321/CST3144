const express = require("express");
const http = require("http");
const path = require("path");
const PropertiesReader = require("properties-reader");
const cors = require("cors");
const bodyParser = require("body-parser");
const { MongoClient, ObjectId } = require("mongodb");

// Initialize Express application
const app = express();

// Set the path to your properties file
const propertiesPath = path.resolve(__dirname, "conf/db.properties");

// Load the properties file
const properties = PropertiesReader(propertiesPath);

// Retrieve MongoDB connection details
const dbPrefix = properties.get("db.prefix");
const dbUser = encodeURIComponent(properties.get("db.user"));
const dbPwd = encodeURIComponent(properties.get("db.pwd"));
const dbName = properties.get("db.name");
const dbUrl = properties.get("db.dbUrl");
const dbParams = properties.get("db.params");

// Construct the MongoDB connection URI
const uri = `${dbPrefix}${dbUser}:${dbPwd}${dbUrl}${dbParams}`;
console.log("MongoDB URI: ", uri);

// Initialize MongoDB client
const client = new MongoClient(uri);

// Function to connect to MongoDB
async function connectDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");
  } catch (error) {
    console.error("Error connecting to MongoDB: ", error);
    process.exit(1); // Exit the application if DB connection fails
  }
}

// Connect to the database
connectDB();

// Enable CORS for all routes
app.use(cors());

// Middleware to parse incoming JSON requests
app.use(bodyParser.json());

// Middleware to log incoming requests
app.use((req, res, next) => {
  console.log(`In comes a ${req.method} request to ${req.url}`);
  next();
});

// Serve static files from the images directory
const imagePath = path.resolve(__dirname, "images");
app.use("/images", express.static(imagePath));

// Middleware to handle dynamic collection names
app.param("collectionName", (req, res, next, collectionName) => {
  req.collection = client.db(dbName).collection(collectionName);
  next();
});

// Route: Home
app.get("/", (req, res) => {
  res.send("Welcome to Home");
});

// Route: Get all documents from a collection
app.get("/collections/:collectionName", async (req, res, next) => {
  try {
    const results = await req.collection.find({}).toArray();
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// Route: Create a document in a collection
app.post("/collections/:collectionName", async (req, res, next) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).send("There is no data to add");
  }

  try {
    const result = await req.collection.insertOne(req.body);
    res.json({
      message: "Document successfully created",
      insertedId: result.insertedId,
    });
  } catch (err) {
    next(err);
  }
});

// Route: Delete a document from a collection
app.delete("/collections/:collectionName/:id", async (req, res, next) => {
  try {
    const result = await req.collection.deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.json(result.deletedCount === 1 ? { msg: "success" } : { msg: "error" });
  } catch (err) {
    next(err);
  }
});

// Route: Update a document in a collection
app.put("/collections/:collectionName/:id", async (req, res, next) => {
  try {
    const result = await req.collection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body },
      { safe: true, multi: false }
    );
    res.json(result.matchedCount === 1 ? { msg: "success" } : { msg: "error" });
  } catch (err) {
    next(err);
  }
});

// Routes for orders
// Route: Create a new order
app.post("/orders", async (req, res) => {
  try {
    const { name, phoneNumber, lessonIDs, numSpaces } = req.body;

    if (!name || !phoneNumber || !lessonIDs || !numSpaces) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!Array.isArray(lessonIDs) || typeof numSpaces !== "number") {
      return res.status(400).json({ message: "Invalid data types" });
    }

    const ordersCollection = client.db(dbName).collection("orders");
    const result = await ordersCollection.insertOne({
      name,
      phoneNumber,
      lessonIDs,
      numSpaces,
      createdAt: new Date(),
    });

    res.status(201).json({
      message: "Order successfully created",
      orderId: result.insertedId,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).send("Failed to create order");
  }
});

// Route: Get all orders
app.get("/orders", async (req, res) => {
  try {
    const ordersCollection = client.db(dbName).collection("orders");
    const allOrders = await ordersCollection.find({}).toArray();
    res.status(200).json(allOrders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).send("Failed to fetch orders");
  }
});

// Error handler for unhandled routes or other errors
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wrong!");
});

// Start the server
const PORT = process.env.PORT || 3000;
http.createServer(app).listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
