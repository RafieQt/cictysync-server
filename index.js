const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-1dyistj-shard-00-00.f4bf0kb.mongodb.net:27017,ac-1dyistj-shard-00-01.f4bf0kb.mongodb.net:27017,ac-1dyistj-shard-00-02.f4bf0kb.mongodb.net:27017/?ssl=true&replicaSet=atlas-v7wytu-shard-0&authSource=admin&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("citysync_db");
    const userCollection = db.collection("/users");

    // Users API
    app.get("/users", async (req, res) => {
      const query = {};
      const { email } = req.query;

      if (email) {
        query.email = email;
      }
      const cursor = await userCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const newUser = {...user, role: "citizen", status: "active", isPremium: false}
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });


    // Issue API
    app.post('/issues', async(req, res)=>{
      const issue = req.body;
    })

    app.get('/issues', async(req, res)=>{
      
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("City is Syncing");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
