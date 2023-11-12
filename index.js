const express = require("express");
const cors = require("cors");
let cookieParser = require('cookie-parser')
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
let jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5999;



// build in middleware
app.use(cors({
  origin:['https://bookboulevard-a7548.firebaseapp.com',
  'https://bookboulevard-a7548.web.app'
],
  credentials:true
}));
app.use(cookieParser())
app.use(express.json());







const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.ne92jzz.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const bookCollection = client.db("bookBoulevard").collection("books");
const borrowedBooksCollection = client.db("bookBoulevard").collection("borrowedBooks"); 
const librarianCollection = client.db("bookBoulevard").collection("librarian"); 
const categoriesCollection = client
  .db("bookBoulevard")
  .collection("categories");


//Custom Auth middleWare

const verifyToken=(req,res,next) => {
  let token=req.cookies.token
if(!token) {
  return res.status(401).send({message:'401 Unauthorized request'})
}
  jwt.verify(token, process.env.SECRET_KEY, function(err, decoded) {
    if(err){
  
      return res.status(401).send({message:'401 Unauthorized request'})
    }
  res.email = decoded.email
    next() // bar
  });
}
const verifyLibrarian=async(req,res,next) => {
  email=res.email
 let librarian=await librarianCollection.findOne({email:email})
 if(!librarian){
  return res.status(403).send({message:'Only liberian can do this'})
 }
 next()
}


app.get("/", (req, res) => {
  res.send("Welcome to the server of BookBoulevard");
});
app.post('/jwt',async (req, res) => {
 let email= req.body
  let accessToken=jwt.sign(email, process.env.SECRET_KEY, { expiresIn: '1h' });

  res.cookie('token', accessToken,{
    httpOnly:true,sameSite:"none",secure:true
  })
  res.send({message:'thanks'})
})

async function run() {
  try {
    app.post("/books",verifyToken,verifyLibrarian, async (req, res) => {
      let book = req.body;
      const result = await bookCollection.insertOne(book);
      res.send(result);
    });
    app.get("/categories", async (req, res) => {
      let cursor =  categoriesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.patch("/books", async (req, res) => {
      let book = req.body;
      let filter={_id:new ObjectId(book.id)}
     const result = await bookCollection.updateOne(filter,{$set:{quantity:book.quantity}});
      res.send(result);
    });


    app.get("/category", async (req, res) => {
      let category = req.query.category;

      let query = { category: category };
      let cursor = await bookCollection.find(query).limit(4).skip(0);
      const result = await cursor.toArray();
      res.send(result);
    });











    app.get("/books/:id", async (req, res) => {
      let page = parseInt(req.params.id);
      let perPage = parseInt(req.query.perpage);
let available=req.query.available
      let filter;


     if(available==='true'){
      filter={quantity: { $gt: 0 }}
     }
let number=(await bookCollection.find(filter).toArray()).length

     let cursor =  bookCollection
     .find(filter)
     .limit(perPage)
     .skip(page * perPage);
      const result = await cursor.toArray();

      res.send({result,number});
    });
















    app.get("/allbooks/category/:id", async (req, res) => {
      let id = req.params.id;
      let cursor = bookCollection.find({ category: id });
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/book/:id", async (req, res) => {
      let id = req.params.id;
      const result = await bookCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.put("/book/:id",verifyToken,verifyLibrarian, async (req, res) => {
      let id = req.params.id;
      let data = req.body;
      let updateData = {
        $set: {
          image: data.image,
          name: data.name,
          quantity: data.quantity,
          author: data.author,
          category: data.category,
          description: data.description,
          rating: data.rating,
          sneakPeek: data.sneakPeek,
        },
      };
      let options = { upsert: false };
      let filter = { _id: new ObjectId(id) };
      const result = await bookCollection.updateOne(
        filter,
        updateData,
        options
      );
      res.send(result);
    });
app.delete("/book/:id",verifyToken,verifyLibrarian,  async (req, res) => {
  let id = req.params.id;
  filter={_id:new ObjectId(id)}
  let result=await bookCollection.deleteOne(filter)
  res.send(result)
})
    app.get("/booksnumber", async (req, res) => {
      const number = await bookCollection.estimatedDocumentCount();
      res.send({ number });
    });
    app.get("/borrowedbooks",verifyToken, async (req, res) => {
      let email=req.query.email
      if(res.email!==email){
    return res.status(401).send({message:'401 Unauthorized request'})
      }


      const cursor =   borrowedBooksCollection.find({email:email});
const result=await cursor.toArray();
      res.send(result);
    });
app.post("/borrowedBook",verifyToken,async (req, res) => {
  let data=req.body
  let email=req.body.email
  let filter={id:data.id,email:email}
  let check=await borrowedBooksCollection.findOne(filter)
  if(check){
    return res.send({message:'already Added'});
  }
const result = await borrowedBooksCollection.insertOne(data)
res.send(result);
})
app.get("/borrowedBook/:id",verifyToken, async (req, res) => {

  let id=req.params.id
  let email=req.query.email
  if(res.email!==email){
return res.status(401).send({message:'401 Unauthorized request'})
  }

let filter={id:id,email:email}
let result=await borrowedBooksCollection.findOne(filter)
res.send(result)

})
app.delete("/borrowedbooks/:id",async (req, res) => {
  let id = req.params.id;
  filter={_id:new ObjectId(id)}
  let result=await borrowedBooksCollection.deleteOne(filter)
  res.send(result)
})
    // Send a ping to confirm a successful connection
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log("listening on port : ", port);
});
