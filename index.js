const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const cors = require('cors')
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const app = express()
const port = process.env.PORT || 5000
app.use(express.json())
app.use(cors())
app.get('/', (req, res) => {
  res.send('Hello World!------------------')
})
const verifyJwt = (req,res,next) => {
  const authorization = req.headers.authorization 
  if (!authorization) {
    return res.status(401).send({ error: true, massage:'unAuthorization....'})
  }
  const token = authorization.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({error: true, massage:'unAuthorization!!!'})
    }
    req.decoded = decoded 
    next()
  })
  }
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.s0tuw8w.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    const userCollection = client.db('bistroBoss').collection('user')
    const menuCollection = client.db('bistroBoss').collection('menu')
    const reviewCollection = client.db('bistroBoss').collection('review')
    const cartCollection = client.db('bistroBoss').collection('carts')
    const paymentCollection = client.db('bistroBoss').collection('payments')
     
    // jwt token
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '6d'});
      res.send({token})
    })


    const adminVerify =async (req, res, next) => {
      const email = req.decoded.email 
      const query = { email: email }
      const users = await userCollection.findOne(query)
      if (users?.role !== 'admin') {
         return res.status(401).send({error:true ,massage:'unAuthorization'})
      }
      next()
    }
    // user related api 
    app.post('/user', async (req, res) => {
      const user = req.body 
      const query = { email: user.email }
      const oldUser = await userCollection.findOne(query)
      if (oldUser) {
         return
       }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })
    app.get('/allUser',verifyJwt,adminVerify, async(req, res) => {
      const query = {}
      const result = await userCollection.find(query).toArray()
      res.send(result)
    })

    app.delete('/userDelete/:id', async (req, res) => {
      const id = req.params.id 
      const filter = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(filter)
      res.send(result)
    })

    app.patch('/user/admin/:id', async (req, res) => {
      const id = req.params.id 
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updateDoc = {
        $set: {
           role:'admin'
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc,options)
      res.send(result)
    })
  
    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email 
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const result = { admin: user?.role === 'admin' }
      res.send(result)
    })
    // menu related api
    app.get('/menu', async(req, res) => {
      const query = {}
      const result = await menuCollection.find(query).toArray()
      res.send(result)
    })
   
    app.post('/menus',verifyJwt,adminVerify, async (req, res) => {
      const menuItem = req.body 
      const result = await menuCollection.insertOne(menuItem)
      res.send(result)
    })

    app.delete('/menuItem/:id',verifyJwt,adminVerify,async (req, res) => {
      const id = req.params.id 
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.deleteOne(query)
      res.send(result)
    })
    // review related api
    app.get('/reviews', async (req, res) => {
      const email = req.query.email
      console.log(email)
      const query = { email: email }
      const result = await reviewCollection.find(query).toArray()
      res.send(result)
    })
    app.get('/review', async(req, res) => {
      const query = {}
      const result = await reviewCollection.find(query).toArray()
      res.send(result)
    })
    app.post('/review', verifyJwt, async (req, res) => {
      const query = req.body 
      const result = await reviewCollection.insertOne(query)
      res.send(result)
    })
    
    // cart related api
    app.get('/carts',verifyJwt, async (req, res) => {
      
      const decodedEmail = req.decoded.email
      
      if (decodedEmail !== req.query.email) {
        return res.status(403).send({error:true,massage:'unAuthorization'})
      }
      const email = req.query.email
       const query ={email:email}
      const result = await cartCollection.find(query).toArray()
      res.send(result)
    })
    app.post('/carts',async (req, res) => {
      const item = req.body
      const result = await cartCollection.insertOne(item)
     res.send(result)
    })
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id 
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })
    app.get('/carts/:id', async (req, res) => {
      const id = req.params.id 
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.findOne(query)
      res.send(result)
    })

    app.patch('/carts/:id',verifyJwt, async (req, res) => {
      const id = req.params.id 
      const query = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updateDoc = {
        $set: {
           role:'complete'
        },
      };
      const result = await cartCollection.updateOne(query, updateDoc, options)
      res.send(result)
      
    })

    // payment Gateway 
    app.post('/create-payment-intent',verifyJwt, async (req, res) => {
      const { price } = req.body
      const total = parseInt(price * 100)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: total,
        currency: "usd",
        payment_method_types: [
          "card"
        ],
      })
       res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })
    app.post('/payment',verifyJwt, async (req, res) => {
      const  paymentDetails = req.body 
      const result = await paymentCollection.insertOne(paymentDetails) 
      res.send(result)
    })
    app.get('/order-stats',verifyJwt,adminVerify, async (req, res) => {
      const query = {}
      const result = await paymentCollection.find(query).toArray()
      res.send(result)
    })
    // booking 
   
    app.get('/booking', verifyJwt, async (req,res) => {
      const email = req.query.email 
      const filter = { email: email }
      const result = await paymentCollection.find(filter).toArray()
      res.send(result)
    })
    // start payment gateway
    app.get('/admin-states',verifyJwt,adminVerify, async (req, res) => {
      const user = await userCollection.estimatedDocumentCount()
      const menuItem = await menuCollection.estimatedDocumentCount()
      const order = await paymentCollection.estimatedDocumentCount()
      const payment = await paymentCollection.find().toArray()
      const revenue =payment.reduce ((sum,currentValue)=>currentValue.price + sum,0)
      res.send({
        user,
        menuItem,
        order,
        revenue
      })
    })
    // pipeline mongodb 
    app.get('/order-stats', async(req, res) =>{
      const pipeline = [
        {
          $lookup: {
            from: 'menu',
            localField: 'menuItems',
            foreignField: '_id',
            as: 'menuItemsData'
          }
        },
        {
          $unwind: '$menuItemsData'
        },
        {
          $group: {
            _id: '$menuItemsData.category',
            count: { $sum: 1},
            total: { $sum: '$menuItemsData.price' }
          }
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            total: { $round: ['$total', 2] },
            _id: 0
          }
        }
      ];

      const result = await paymentCollection.aggregate(pipeline).toArray()
      res.send(result)

    }) 
  }
  finally {  
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})