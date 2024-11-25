const express = require("express");
const http = require("http");
const path = require("path");
const PropertiesReader = require("properties-reader");
const cors = require("cors");
const app = express();
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require("mongodb");



// Set the path to your properties file
 const propertiesPath = path.resolve(__dirname, 'conf/db.properties');



//load the properties file
const properties = PropertiesReader(propertiesPath);



// Log the values to see if they are being read correctly
console.log("Properties file path:", propertiesPath);
console.log("File contents:", require('fs').readFileSync(propertiesPath, 'utf-8'));
console.log("DB Prefix:", properties.get("db.prefix"));
console.log("DB Username:", properties.get("db.user"));
console.log("DB Password:", properties.get("db.pwd"));
console.log("DB URL:", properties.get("db.dbUrl"));



//retrieving mongodb connection details from the properties file
let dbPrefix = properties.get("db.prefix");
let dbUser = encodeURIComponent(properties.get("db.user"));
let dbPwd = encodeURIComponent(properties.get("db.pwd"));
let dbName = properties.get("db.name");
let dbUrl = properties.get("db.dbUrl");
let dbParams = properties.get("db.params");




// Construct the connection URI
const uri = `${dbPrefix}${dbUser}:${dbPwd}${dbUrl}${dbParams}`;
console.log("MongoDB URI: ", uri);



// MongoDB Connection using Stable API
const client = new MongoClient(uri);


async function connectDB() {
  try {
      await client.connect(); // Establish the connection
      console.log("Connected to MongoDB!");
      


      // Access the database and perform a simple query to verify the connection
      const db = client.db(dbName);  // Get a database instance
      const collection = db.collection('products'); 
      const allDocuments = await collection.find({}).toArray(); // Find a sample document

      console.log("All documents from MongoDB:", allDocuments); // log all documents

  } catch (error) {
      console.error("Error connecting to MongoDB: ", error);
  }
}

connectDB();




//enabling cors for all routes
app.use(cors());



//middleware to parse requests coming as json
app.use(bodyParser.json());



//middleware to logging the requests coming
app.use((request, response, next) => {
    console.log("In comes a " + request.method + " to " + request.url);
    next();
});

//app.use((request, response, next) => {
   // const minute = new Date().getMinutes();
   // if (minute % 2 === 0) { // continue if it is on an even minute
      //  next();
   // } else { // otherwise responds with an error code and stops
     //   response.status(403).send("Not authorized.");
   // }

//});


//here we are doing the routes for images

const imagePath = path.resolve(__dirname, "images");


//this is the path to the imgages folder
app.use("/images", express.static(imagePath));//url path for serving images



//creating the rest api for reading and getting documents
// Middleware to handle dynamic collection names
app.param('collectionName', function(req, res, next, collectionName) {
  req.collection = client.db(dbName).collection(collectionName); // Set the collection to be used
  return next();
});



// Route to get all documents from a collection
app.get('/collections/:collectionName', (req, res, next) => {
  req.collection.find({}).toArray((err, results) => {
      if (err) {
          return next(err);
      }
      res.json(results); // Return the documents as JSON
  });
});



// ============================================
// routes for new collection which is orders
// =============================================

// Route to create a new order
app.post('/orders', async (req, res) => {
  try {
    // here im Destructure the incoming data from the request body
    const { name, phoneNumber, lessonIDs, numSpaces } = req.body;

    // Validation: Ensure required fields are provided
    if (!name || !phoneNumber || !lessonIDs || !numSpaces) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Ensure lessonIDs is an array and numSpaces is a number
    if (!Array.isArray(lessonIDs) || typeof numSpaces !== 'number') {
      return res.status(400).json({ message: 'Invalid data types' });
    }

    // Access the database and the orders collection
    const db = client.db(dbName); 
    const ordersCollection = db.collection('orders'); 

    // Insert the new order into the collection
    const result = await ordersCollection.insertOne({
      name,
      phoneNumber,
      lessonIDs,
      numSpaces,
      createdAt: new Date(), // Include creation time
    });

    // Send a response with the inserted order's ID
    res.status(201).json({
      message: 'Order successfully created',
      orderId: result.insertedId, // Return the inserted order ID
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).send('Failed to create order');
  }
});


// Route to get all orders
app.get('/orders', async (req, res) => {
  try {
    // Access the database and the orders collection
    const db = client.db(dbName);
    const ordersCollection = db.collection('orders');

    // Retrieve all orders from the collection
    const allOrders = await ordersCollection.find({}).toArray();

    // Respond with the list of orders
    res.status(200).json(allOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).send('Failed to fetch orders');
  }
});





//route to post documents to the collection
app.post('/collections/:collectionName', function(req, res, next) {
  // Ensure the request body has data
  if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).send('there is no data to add');
  }


  // Insert the new document into the specified collection
  req.collection.insertOne(req.body, function(err, results) {
      if (err) {
          return next(err);  // If there's an error, pass it to the error handler
      }
      res.json({
          message: 'Document successfully created',
          insertedId: results.insertedId  
      });  
  });
});


//route for deleting the documents from the collection
app.delete('/collections/:collectionName/:id'
  , function(req, res, next) {
   req.collection.deleteOne(
   {_id: new ObjectId(req.params.id)}, function(err, result) {
   if (err) {
   return next(err);
   } else {
   res.send((result.deletedCount === 1) ? {msg: "success"} : {msg: "error"});
   }
   }
   );
  })



  //route for putor update the documents from the collection
  app.put('/collections/:collectionName/:id'
    , function(req, res, next) {
     // TODO: Validate req.body
     req.collection.updateOne({_id: new ObjectId(req.params.id)},
     {$set: req.body},
     {safe: true, multi: false}, function(err, result) {
     if (err) {
     return next(err);
     } else {
     res.send((result.matchedCount === 1) ? {msg: "success"} : {msg: "error"});
     }
     }
     );
    });


// Error handler for unhandled routes or other errors
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// Start the server
http.createServer(app).listen(3000, () => {
  console.log("Server is listening on port 3000");
});