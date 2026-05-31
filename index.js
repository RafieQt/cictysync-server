const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

let stripeClient = null;
const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!stripeClient) stripeClient = require("stripe")(key);
  return stripeClient;
};

app.use(express.json());
app.use(cors());

const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-1dyistj-shard-00-00.f4bf0kb.mongodb.net:27017,ac-1dyistj-shard-00-01.f4bf0kb.mongodb.net:27017,ac-1dyistj-shard-00-02.f4bf0kb.mongodb.net:27017/?ssl=true&replicaSet=atlas-v7wytu-shard-0&authSource=admin&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  try {
    req.decoded = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).send({ message: "Invalid or expired token" });
  }
};

const buildIssueQuery = (query) => {
  const filter = {};
  if (query.category) filter.category = query.category;
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.search) {
    filter.$or = [
      { title: { $regex: query.search, $options: "i" } },
      { location: { $regex: query.search, $options: "i" } },
      { description: { $regex: query.search, $options: "i" } },
    ];
  }
  return filter;
};

async function run() {
  try {
    await client.connect();
    const db = client.db("citysync_db");
    // Legacy DB used collection name "/users"
    const userCollection = db.collection("users");
    const issueCollection = db.collection("issues");
    const paymentCollection = db.collection("payments");

    app.post("/jwt", async (req, res) => {
      const { email } = req.body;
      if (!email) return res.status(400).send({ message: "Email required" });
      const token = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });
      res.send({ token });
    });

    // ── Users ──────────────────────────────────────────────────────────────
    app.get("/users", async (req, res) => {
      const query = {};
      if (req.query.email) query.email = req.query.email;
      if (req.query.role) query.role = req.query.role;
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
     
      console.log(req.body);
      const user = req.body;

      console.log("REQ BODY:", user);

      if (!user?.email) {
        return res.status(400).send({ message: "Email required" });
      }

      const updateFields = {
        email: user.email,
        name: user.name,
        photo: user.photo, 
      };

      const result = await userCollection.updateOne(
        { email: user.email },
        {
          $set: updateFields,
          $setOnInsert: {
            role: "citizen",
            status: "active",
            isPremium: false,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );

      res.send(result);
    });

    app.patch("/users/:email", verifyToken, async (req, res) => {
      const updates = { ...req.body };
      delete updates.email;
      delete updates._id;
      const result = await userCollection.updateOne(
        { email: req.params.email },
        { $set: updates },
      );
      res.send(result);
    });

    // ── Issues ─────────────────────────────────────────────────────────────
    app.get("/issues", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 9;
      const filter = buildIssueQuery(req.query);
      const skip = (page - 1) * limit;
      const [result, total] = await Promise.all([
        issueCollection
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        issueCollection.countDocuments(filter),
      ]);
      res.send({ result, total });
    });

    app.get("/issues/user/:email", verifyToken, async (req, res) => {
      const filter = { userEmail: req.params.email };
      if (req.query.status) filter.status = req.query.status;
      const result = await issueCollection
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/issues/staff/:email", verifyToken, async (req, res) => {
      const filter = { "assignedStaff.email": req.params.email };
      if (req.query.status) filter.status = req.query.status;
      const result = await issueCollection
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/issues/:id", async (req, res) => {
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).send({ message: "Invalid issue id" });
      }
      const issue = await issueCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      if (!issue) return res.status(404).send({ message: "Issue not found" });
      res.send(issue);
    });

    app.post("/issues", verifyToken, async (req, res) => {
      try {
        const issue = req.body;
        if (!issue?.userEmail || !issue?.title) {
          return res
            .status(400)
            .send({ message: "Missing required issue fields" });
        }

        const dbUser = await userCollection.findOne({ email: issue.userEmail });
        if (dbUser && !dbUser.isPremium) {
          const count = await issueCollection.countDocuments({
            userEmail: issue.userEmail,
          });
          if (count >= 3) {
            return res
              .status(403)
              .send({ message: "Free users can only submit 3 issues" });
          }
        }

        const newIssue = {
          title: issue.title,
          description: issue.description,
          category: issue.category,
          location: issue.location,
          image: issue.image,
          userEmail: issue.userEmail,
          userName: issue.userName,
          userPhoto: issue.userPhoto,
          status: "pending",
          priority: "normal",
          upvotes: [],
          assignedStaff: null,
          timeline: [
            {
              status: "Reported",
              message: "Issue reported by citizen",
              updatedBy: issue.userEmail,
              role: "citizen",
              date: new Date(),
            },
          ],
          createdAt: new Date(),
        };
        const result = await issueCollection.insertOne(newIssue);
        res.send(result);
      } catch (err) {
        console.error("POST /issues error:", err.message);
        res
          .status(500)
          .send({ message: err.message || "Failed to create issue" });
      }
    });

    app.patch("/issues/:id", verifyToken, async (req, res) => {
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).send({ message: "Invalid issue id" });
      }
      const updates = { ...req.body };
      const timelineEntry = updates.timelineEntry;
      delete updates.timelineEntry;
      delete updates._id;

      const setOps = { $set: updates };
      if (timelineEntry) {
        setOps.$push = { timeline: timelineEntry };
      }
      if (updates.status === "resolved" || updates.priority === "high") {
        // allow boost via payment flow
      }

      const result = await issueCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        setOps,
      );
      res.send(result);
    });

    app.patch("/issues/:id/upvote", verifyToken, async (req, res) => {
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).send({ message: "Invalid issue id" });
      }
      const { email } = req.body;
      const issue = await issueCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      if (!issue) return res.status(404).send({ message: "Issue not found" });
      if (issue.upvotes?.includes(email)) {
        return res.status(400).send({ message: "Already upvoted" });
      }
      await issueCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $addToSet: { upvotes: email } },
      );
      res.send({ success: true });
    });

    app.delete("/issues/:id", verifyToken, async (req, res) => {
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).send({ message: "Invalid issue id" });
      }
      const result = await issueCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // ── Stats ──────────────────────────────────────────────────────────────
    app.get("/stats/citizen/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const issues = await issueCollection.find({ userEmail: email }).toArray();
      const payments = await paymentCollection
        .find({ userEmail: email })
        .toArray();
      res.send({
        total: issues.length,
        pending: issues.filter((i) => i.status === "pending").length,
        inProgress: issues.filter((i) => i.status === "in-progress").length,
        resolved: issues.filter((i) => i.status === "resolved").length,
        totalPayments: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
      });
    });

    app.get("/stats/staff/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const issues = await issueCollection
        .find({ "assignedStaff.email": email })
        .toArray();
      res.send({
        assigned: issues.length,
        pending: issues.filter((i) => i.status === "pending").length,
        inProgress: issues.filter((i) => i.status === "in-progress").length,
        resolved: issues.filter((i) => i.status === "resolved").length,
      });
    });

    

    

    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB");

    app.get("/", (req, res) => {
      res.send("City is Syncing");
    });

    app.listen(port, () => {
      console.log(`CitySync server listening on port ${port}`);
      console.log(
        getStripe()
          ? "Stripe: configured"
          : "Stripe: NOT configured (add STRIPE_SECRET_KEY to .env)",
      );
    });
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

run().catch(console.dir);
