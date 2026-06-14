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

const logger = (req, res, next) => {
  console.log('logger middleware logged', req.params);
  next();
}


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
    const sessionCollection = database.collection("session");

    //verification related
    const verifyToken = async (req, res, next) => {

      const authHeader = req.headers?.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' })
      }

      const token = authHeader.split(' ')[1]
      if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
      }

      const query = { token: token }
      const session = await sessionCollection.findOne(query);
      if (!session) {
        return res.status(401).send({ message: 'unauthorized access' })
      }

      const userId = session.userId;


      const userQuery = {
        _id: userId
      }

      const user = await userCollection.findOne(userQuery);
      if (!user) {
        return res.status(401).send({ message: 'unauthorized access' })
      }

      // set data in the req object
      req.user = user;

      next();
    }

    // must be used after verifyToken middleware
    const verifySeeker = async (req, res, next) => {
      if (req.user?.role !== 'seeker') {
        return res.status(403).sent({ message: 'forbidden access' })
      }
      next();
    }

    // must be used after verifyToken middleware
    const verifyRecruiter = async (req, res, next) => {
      if (req.user.role !== 'recruiter') {
        return res.status(403).sent({ message: 'forbidden access' })
      }
      next();
    }

    // must be used after verifyToken middleware
    const verifyAdmin = async (req, res, next) => {
      if (req.user.role !== 'admin') {
        return res.status(403).sent({ message: 'forbidden access' })
      }
      next();
    }


    // app.get("/api/users", async (req, res) => {

    //   const cursor = userCollection.find().skip(6);
    //   const result = await cursor.toArray();
    //   res.json(result);
    // });

    //jobs related api
    app.get("/api/jobs", async (req, res) => {
      console.log('server side Q', req.query);
      const query = {};

      //job filter related query

      if (req.query.search) {
        query.$or = [
          { jobTitle: { $regex: req.query.search, $options: 'i' } },
          {
            companyName: { $regex: req.query.search, $options: 'i' }
          }
        ]
      }

      if (req.query.jobType) {
        query.jobType = req.query.jobType
      }
      if (req.query.jobCategory) {
        query.jobCategory = req.query.jobCategory
      }
      if (req.query.isRemote) {
        query.isRemote = req.query.isRemote
      }


      // company related query
      if (req.query.companyId) {
        query.companyId = req.query.companyId;
      }
      if (req.query.status) {
        query.status = req.query.status;
      }

      //pagination related
      if (req.query.page) {
        const page = req.query.page;
        const perPage = req.query.perPage || 12;
        const skipItems = (page - 1)* perPage;
         
        const total = await jobsCollection.countDocuments(query);
        const cursor = jobsCollection.find(query).skip(skipItems).limit(perPage);
        const jobs = await cursor.toArray();
        return res.send({total, jobs});
      }

      const cursor = jobsCollection.find(query);
      const jobs = await cursor.toArray();
      res.send(jobs);
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
    app.get("/api/applications", verifyToken, verifySeeker, async (req, res) => {
      const query = {};
      if (req.query.applicantId) {
        query.applicantId = req.query.applicantId;

        // check whether asking for user information or someone else
        console.log(req.user, req.query.applicantId);
        if (req.user._id.toString() !== req.query.applicantId) {
          return res.status(403).sent({ message: 'forbidden access' })
        }
      }
      if (req.query.jobId) {
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
    // app.get("/api/companies", async (req, res) => {
    //   const cursor = companiesCollection.find();
    //   const result = await cursor.toArray();
    //   res.send(result);
    // });

    // inefficient way to join/aggregate collection
    app.get("/api/companies", logger, verifyToken, async (req, res) => {
      const cursor = companiesCollection.find();
      const companies = await cursor.toArray();

      for (const company of companies) {
        const filter = {
          companyId: company._id.toString()
        }
        const jobCount = await jobsCollection.countDocuments(filter)
        company.jobCount = jobCount
      }

      res.send(companies);
    });


    // inefficient way to join/aggregate collection
    app.get("/api/companies2", async (req, res) => {
      const pipeline = [
        {
          $skip: 5
        },
        {
          $limit: 2
        }
      ]
      const cursor = companiesCollection.aggregate(pipeline);
      const result = await cursor.toArray();
      res.send(result)
    });

    app.get('/api/stats', async (req, res) => {
      const pipeline = [
        {
          $group: {
            _id: '$jobType',
            count: {
              $sum: 1
            }
          }
        },
        {
          $project: {
            jobType: '$_id',
            _id: 0,
            count: 1
          }
        },
        {
          $sort: { count: -1 }
        }
      ]
      const cursor = jobsCollection.aggregate(pipeline);
      const result = await cursor.toArray();
      res.send(result)
    })

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

    app.patch("/api/companies/:id", logger, verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const updatedCompany = req.body;

      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          status: updatedCompany.status,
        },
      };

      const result = await companiesCollection.updateOne(filter, updateDoc);
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
      const filter = { email: data.email }
      const updateDocument = {
        $set: {
          plan: data.planId,
        },
      };
      const updateResult = await userCollection.updateOne(filter, updateDocument);
      res.send(updateResult)
    })


    // await client.db("admin").command({ ping: 1 });
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
