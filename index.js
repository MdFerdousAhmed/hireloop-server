const express = require("express");
const cors = require("cors");
const app = express();
const port = 5000;
require("dotenv").config();
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const database = client.db("hireloop_db");
    const jobsCollection = database.collection("jobs");
    const companiesCollection = database.collection("companies");

    app.get("/api/jobs", async (req, res) => {
      const query = {};
      if (req.query.companyId) {
        query.companyId = req.query.companyId;
      }
      if (req.query.status) {
        query.status = req.query.status;
      }
      const cursor = jobsCollection.find(query);
      const jobs = await cursor.toArray();
      res.json(jobs);
    });

    app.post("/api/jobs", async (req, res) => {
      const job = req.body;
      try {
        const result = await jobsCollection.insertOne(job);
        res.status(201).json(result.ops[0]);
      } catch (error) {
        console.error("Error inserting job:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.get("/api/my/companies", async (req, res) => {
      const query = {};

      if (req.query.recruiterId) {
        query.recruiterId = req.query.recruiterId;
      }

      const result = await companiesCollection.findOne(query);
      res.json(result ?? null);
    });

    app.post("/api/companies", async (req, res) => {
      const company = req.body;
      const result = await companiesCollection.insertOne(company);
      res.status(201).json(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

run();
