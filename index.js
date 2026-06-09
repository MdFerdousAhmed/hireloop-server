const express = require("express");
const cors = require("cors");
const app = express();
const port = 5000;
require("dotenv").config();
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
    const userCollection = database.collection("user");
    const applicationsCollection = database.collection("applications");
    const plansCollection = database.collection("plans");
    const subscriptionCollection = database.collection("subscriptions");

    app.get("/api/users", async (req, res) => {

      const cursor = userCollection.find().skip(6);
      const result = await cursor.toArray();
      res.json(result);
    });

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

    app.get("/api/jobs/:id", async (req, res) => {

      const id = req.params.id;
      const query = {
         _id: new ObjectId(id)
        };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });



    app.post("/api/jobs", async (req, res) => {

      const job = req.body;
      const newJob = {
        ...job,
        createdAt: new Date()
      };
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);

    });

    // application related api
    app.get("/api/applications", async (req, res) => {
      const query = {};
      if(req.query.applicantId){
        query.applicantId = req.query.applicantId;
      }
      if(req.query.jobId){
        query.jobId = req.query.jobId;
      }
      const cursor = applicationsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/api/applications", async (req, res) => {
      const application = req.body;
      const newApplication = {
        ...application,
        createdAt: new Date()
      };
      const result = await applicationsCollection.insertOne(newApplication);
      res.send(result);
    });

    // company related api
    app.get("/api/companies", async (req, res) => {
      const cursor = companiesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/api/my/companies", async (req, res) => {
      const query = {};
      if (req.query.recruiterId) {
        query.recruiterId = req.query.recruiterId;
      }

      const result = await companiesCollection.findOne(query);
      res.send(result || {});
    });

    app.post("/api/companies", async (req, res) => {
      const company = req.body;
      const newCompany = {
        ...company,
        createdAt: new Date()
      };
      const result = await companiesCollection.insertOne(newCompany);
      res.send(result);
    });

    // plan related api
    app.get("/api/plans", async (req, res) => {
      const query = {};
      if (req.query.plan_id) {
        query.id = req.query.plan_id;
      }
      const plan = await plansCollection.findOne(query);
      res.send(plan || {});
    });

    // subscription
    app.post('/api/subscriptions', async (req, res) => {
      const data = req.body;
      const subsInfo = {
        ...data,
        createdAt: new Date()
      }
      const result = await subscriptionCollection.insertOne(subsInfo)

      // update the user plan information
      const filter = {email: data.email}
      const updateDocument = {
        $set: {
          plan: data.planId,
        },
      };
      const updateResult = await userCollection.updateOne(filter,updateDocument);
      res.send(updateResult)
    })
     

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
