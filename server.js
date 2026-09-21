import express from 'express';
import { createClient } from "@supabase/supabase-js";
// import { Base64 } from 'js-base64';
// Use dotenv/config for loading environment variables in ESM
import 'dotenv/config'; 
import cors from 'cors';
import { Buffer } from "buffer";
import nodemailer from "nodemailer";

const port = 3000;
const app = express();


const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://98.91.62.10:3000",
  "http://nunesauto1.co.za.s3-website-us-east-1.amazonaws.com",
  "http://www.nunesauto1.co.za.s3-website-us-east-1.amazonaws.com",
  "https://nunes-auto-official.vercel.app",
];


app.use(cors({
  origin: (origin, callback) => {
    if (!origin){
       return callback(null, true);
      }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true
}));



// Middleware
app.use(express.json());



// This is done so that a connection to supabase is possible

let supabase;

const connectToSupabase = async() => {

  try{

    const supabaseSetUp = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SECRET_KEY
);

supabase = supabaseSetUp;
console.log("Supabase successfully connected");

  } catch (error){
    console.error(error);
    console.log("Error connecting to supabase in line 17 - 32");
  }
}



const authentication = async(req, res, next) =>{
  try{

    const authHeader = req.headers.authorization;
    console.log( req.headers)
    console.log( req.headers.authorization)

    // Making sure that the authorization and access token are present
    if( !authHeader || !authHeader.includes("Bearer ") ){
      return res.status(401).json({ message: "User is not authorised" });
    }

    // Seperatin "bearer" from the actual access token
    const accessTokenArray = authHeader.split(" ");

    // Collecting the actual access token value
    const accessToken = accessTokenArray[1];

    // Authenticating to see if the user is actually stored 
    // inside of our collection before permitting the action
    const { data, error } = await supabase.auth.getUser(accessToken);

    if( error ){
      console.error("Error getting the authenticated user from supabase auth using their accesstoken");
      return res.status(401).json({ message: `Error authenticating the user: ${error}` })
    }

    // STORING THE ACTUAL ACCESS TOKEN OF THE USER
console.log("User object returned by authentication function: ",data )
    req.user = data

    // IF THE USER IS AUTHENTICATED THE FETCH REQUEST SHOULD PROCEED
    next()

  }
  catch (error){
    console.error("Error trying to authenticate the user ",error );
    return res.status(500).json({ message: "Internal server error" });
  }
}


// --- PUBLIC ENDPOINTS (No authentication required) ---
// ... (All endpoints remain the same) ...



// Create a new user account
app.post("/signup", async (req, res) => {

    try {

// getting the properties stored in the fetch function
        const { userName, email } = req.body;

  const { data,error } = await supabase.from("users").insert( req.body ).select();

if( error ){
    console.log("Supabase experienced an error while creating the user: ",error)
  return res.status(400).json({ message: error })
}

if ( data ){
    console.log("Supabase successfully created the user: ",data)
return res.status(200).json({ message: data })
}

      } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});



// Get All Brands
app.get("/brands", async (req, res) => {
    try {
        const { data: brands, error } = await supabase
            .from("brands")
            .select("*");

        if (error) {
            throw error;
        }

        res.status(200).json(brands);
    } catch (error) {
        console.error("Error getting brands:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});



// Get All Parts
app.get("/parts", async (req, res) => {
    try {
        const { data: parts, error } = await supabase
            .from("parts")
            .select("*");

        if (error) {
            throw error;
        }

        res.status(200).json(parts);
    } catch (error) {
        console.error("Error retrieving parts:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});



// CALLING THE AUTHENTICATION FUNCTION
// Everything below this requires authentication
app.use(authentication);


// POST - Add item to cart
app.post("/addToCart", async (req, res) => {
  try {
    
    // Getting the authenticated users information
    const { user } = req.user;

    // Getting the id of the user

    const { id } = user;
    console.log("Authentication function provided supabase auth users Id: ",req,user)
    const { product_id, cart_item, quantity } = req.body;

    //Making sure that the required fields are present
    if (!cart_item ||  !quantity || !product_id ) {
      return res.status(400).json({ message: "Invalid item" });
    }

// ADDING ITEM TO THE CART
    const { data, error } = await supabase.from("carts").insert({ user_id: id , product_id, cart_item, quantity }).select();

    if( error ) {
      return res.status(401).json({ message: error })
    }
    if ( data ) {
          res.status(201).json({ message: "Item added to cart", item: data });
    }

  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



// GET - Fetch cart items for a specific user
app.get("/getMyCart/:user_id", async (req, res) => {
  try {

    // DESTRUCTURING REQUIRED PARAMETERS
    const { user_id } = req.params;

    const { data,error } = await supabase.from("carts").select("*").eq("user_id",user_id);

    if( error ){
      console.error( "error getting personal cart ", error )
      return res.status(404).json({ message : "Your cart is not found" });
    }

    if ( data ){
      console.log("Successfully collected cart",data)
      return res.status(200).json({ message : data })
    }

    res.status(200).json(cartItems);
  } catch (error) {
    console.error("Error retrieving user cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



// DELETE - Remove item by user and id
app.delete("/cart/:user_id/:product_id", async (req, res) => {
  try {

    // DESTRUCTURING THE PROPERTIES THAT WE WILL BE USING FOR THE COLLECTION
    const { user_id, product_id } = req.params;
console.log("DSestructuring occured");
    const { data,error } = await supabase.from("carts").select("*").eq("user_id",user_id,"product_id",product_id);
console.log("Supabase select function occured");

    // IF THE PRODUCT IS NOT FOUND IN THE COLLECTION THEN IT CANNOT BE DELETED
    if( error ){
      console.error("Unable to find the product to delete product to delete",error);
      return res.status(409).json({ message: "Item not found in cart", error })
    }

    // IF THE PRODUCT IS FOUND INSIDE OF THE COLLECTION THEN WE WILL PROCEED TO DELETE IT
    if( data ){
console.log( "item was found inside of the users collections");

    const { data,error } = await supabase.from("carts").delete().eq("user_id",user_id).eq("product_id",product_id).select();

    // IF AN ERROR OCCURED WHILE TRYING TO DELETE IT IT SHOULD BE REPORTED
    if( error ){
      return res.status(409).json({ message:"Unable to delete the product", error });
    }

    // REPORTING IF THE PRODUCT WAS SUCCESSFULLY DELETED
    if( data ){
console.log("Product successfully deleted",data);

      return res.status(200).json({ message:"Product successfully deleted", data });
    }

    }

  } catch (error) {
    console.error("Error removing item from cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



app.delete("/clearCart/:user_id", async (req, res) => {
  try {

    // DESTRUCTURING THE USER ID SO THAT WE KNOW WHICH USER_ID TO TARGET
    const { user_id } = req.params;

    console.log("11:31")
//CHECKING TO SEE IF THE USER HAS A CART BEFORE CLEARING THEIR CART
    
  const  { data,error } = await supabase.from("carts").select("*").eq("user_id",user_id);

  if( error ){
    console.error("The current user does not seem to have a cart", error );
    return res.status(404).json({ message:"User currently does noty have a cart" })
  }

  if( data ){

const { data,error } = await supabase.from("carts").delete().eq("user_id",user_id).select();
   
if(error){
  console.log("Unable  to clear a users cart", error);
  return res.status(401).json({ message:"Users cart has been successfully cleared", data });
}

// IF THE CART HAS BEEN SUCCESSFULLY CLEARED THE FOLLOWING CODE WILL RUN
  return res.status(200).json({ message:"Users cart has been successfully cleared", data });

  }

  } catch (error) {
    console.error("Error clearing cart:", error);
    res.status(500).json({ message: "Internal server error clearing cart" });
  }
});


// INSPECTING VIVIANS ENDPOINTS TO BE TESTED WITH POSTMAN

// --- NEW ORDERS ENDPOINTS ---
// POST - Create a new order with customers current cart items
app.post("/newOrder/:user_id", async (req, res) => {
  try {

    // DESTRUCTURING ALL OF THE [PROPERTIES THAT WE WILL RECEIVE FROM THE FRONT END
    const { user_id } = req.params;
    const { ordered_products, delivery_option, sub_total, total } = req.body; 

    // MAKING SURE THAT THE CART IS NOT EMPTY AND THAT THE CUSTOMER IS NOT TRYING TO MAKE AN ORDER WITH AN EMPTY CART 
    if ( ordered_products.length === 0) {
      return res.status(400).json({ message: "Order data is incomplete or empty." });
    }

    const { data, error } = await supabase
      .from("orders")
      .insert( { user_id, ...req.body })
      .select()
      .single();

    if (error) {
      console.error("There was an error trying to check out a users cart in the post orders endpoint: ",error);
      return res.status(401).json({ message: "Unable to post the cart to the orders collection", error })
    }

    if( data ){
 res.status(201).json({ message: "Order placed successfully!" });

    const { data, error } = supabase.from("carts").delete().eq("user_id",user_id).select();

    if( error ){
      return res.status(409).json({ message: "Cart successfully ordered but unable to clear your cart"});
    }

if( data ){
return res.status(200).json({ message:"Checkout cart successfully moved to orders and deleted  from the carts table" });
};

    }

  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});






























// done

// GET - Fetch all orders
app.get("/myOrders/:user_id", async (req, res) => {
  try {

    // DESTRUCTURING USER ID TO KNOW WHICH VARIABLES WE ARE USING TO GET THE ID
    const { user_id } = req.params;

    // Validate ID
    if ( !user_id ) {
      return res.status(400).json({ message: "Invalid CustomerID." });
    }

    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user_id);

    if ( error ) {
      console.error("Error while trying to get the users orders: ", error)
     return res.status(400).json({ messsage: "Error while trying to get the users orders", error })
    }

    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});
    
// Create transporter with full debug logging
export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,  // your Gmail email
    pass: process.env.GMAIL_PASS   // 16-char app password
  },
  logger: true,   // logs SMTP activity
  debug: true     // detailed SMTP debug messages
});









// Helper function to send email
// export async function sendEmail(to, subject, html) {
//   console.log("Preparing to send email:", { to, subject });

//   try {
//     const info = await transporter.sendMail({
//       from: process.env.GMAIL_USER,
//       to,
//       subject,
//       html
//     });

//     console.log("Email sent successfully!", info);
//     return { success: true, info };
//   } catch (error) {
//     console.error("Failed to send email:", error);

//     if (error.response) console.error("SMTP Response:", error.response);
//     if (error.responseCode) console.error("SMTP Response Code:", error.responseCode);

//     return { success: false, error };
//   }
// }

// POST endpoint to send email
// app.post("/send-email", async (req, res) => {
//   const { to, subject, html } = req.body;
//   console.log("POST /send-email received:", { to, subject });

//   const result = await sendEmail(to, subject, html);

//   if (result.success) {
//     console.log("POST /send-email SUCCESS:", to);
//     res.json({ message: "Email sent!", info: result.info });
//   } else {
//     console.error("POST /send-email FAILED:", to, result.error);
//     res.status(500).json({ error: "Failed to send email", details: result.error });
//   }
// });




// UNDER CONSIDERATION

// Get Parts by ID
app.get("/parts/:id", async (req, res) => {
    try {
        const collection = db.collection("Parts");
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid ID format" });
        }
        const part = await collection.findOne({ _id: new ObjectId(id) });
        if (!part) {
            return res.status(404).json({ message: "Part not found" });
        }
        res.status(200).json(part);
    } catch (error) {
        console.error("Error retrieving part:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});



// app.all("/send-email", (req, res, next) => {
//   if (req.method !== "POST") {
//     return res.status(405).json({ message: "Method Not Allowed" });
//   }
//   next();
// });








// done 



// Get User Profile
app.get("/usersProfile/:user_id", async (req, res) => {
    try {

      // DESTRUCTURING THE USER ID TO GET THE USERS PROFILE
const { user_id } = req.params;

        if (!user_id) {
            return res.status(404).json({ message: "User not found" });
        }

        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", user_id)
            .single();

        if (error) {
           console.error("Unable to get the current users profile");
           return res.status(400).json({ message:"Unable to get the users current profile", error })
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});











// Update User Profile
app.put("/updateUsersProfile", async (req, res) => {
    try {
        const { NameAndSurname, Email, Gender, UserNumber } = req.body;
        const { _id } = req.user;
        const collection = db.collection("Users");
        const updateDoc = {
            $set: {
                NameAndSurname,
                Email,
                Gender,
                UserNumber,
                updatedAt: new Date(),
            },
        };
        const result = await collection.updateOne({ _id: new ObjectId(_id) }, updateDoc);
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        const updatedUser = await collection.findOne({ _id: new ObjectId(_id) });
        const userProfile = {
            NameAndSurname: updatedUser.NameAndSurname,
            Email: updatedUser.Email,
            Gender: updatedUser.Gender,
            UserNumber: updatedUser.UserNumber,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt,
        };
        res.status(200).json({ message: "Profile updated successfully", userProfile });
    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});






// work on it


// Delete User Account
app.delete("/removeMyProfile", async (req, res) => {
    try {
        const { _id } = req.user;
        const collection = db.collection("Users");
        const result = await collection.deleteOne({ _id: new ObjectId(_id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({ message: "Account deleted successfully" });
    } catch (error) {
        console.error("Error deleting user account:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});










// Start the server and connect to MongoDB
async function startServer() {
    try {
        await connectToSupabase();
        app.listen(port, "0.0.0.0", () => {
            console.log(`Server listening at http://0.0.0.0/0:${port}`);
        });
    } catch (err) {
        console.error("Failed to connect to supabase or start server:", err);
        process.exit(1);
    }
}

    startServer();