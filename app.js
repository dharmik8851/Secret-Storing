//jshint esversion:6
require("dotenv").config();

const express = require("express");
const app = express();

const bodyParser = require("body-parser");
const ejs = require("ejs");

//passport
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const mongoose = require("mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;

app.use(session({
  secret: 'thisismysecret',
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

const findOrCreate = require('mongoose-findorcreate');
mongoose.set('strictQuery', true);
mongoose.connect("mongodb://127.0.0.1:27017/userDB");
const userSchema = mongoose.Schema({
  email : String,
  password : String,
  googleId : String,
  secret: String});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = mongoose.model("user",userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    cb(null, { id: user.id, username: user.username, name: user.name });
  });
});

passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/secrets"
},
function(accessToken, refreshToken, profile, cb) {
  console.log(profile);
  User.findOrCreate({ googleId: profile.id, username : profile.displayName}, function (err, user) {
    return cb(err, user);
  });
}
));

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

//TODO
app.get("/",function (req,res) {
  res.render("home");
});

app.get("/login",function (req,res) {
  res.render("login");
});

app.get("/register",function (req,res) {
  res.render("register");
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/secrets', 
passport.authenticate('google', { failureRedirect: '/login' }),
function(req, res) {
  // Successful authentication, redirect secrets.
  res.redirect('/secrets');
});

app.get("/secrets", function (req,res) {
  main().catch(err => console.log(err));
  async function main() {
    const foundUsers = await User.find({"secret": {$ne : null}});
    console.log(foundUsers);
    res.render("secrets", {userSecrets : foundUsers});
  }
});

app.get("/submit", function (req,res) {
    if(req.isAuthenticated()){
      console.log(req.user);
      res.render("submit");
    }
    else{
      res.redirect("/login");
    }
});

app.post("/submit",  function (req,res) {
  const submittedSecret = req.body.secret;
  console.log(submittedSecret);

  main().catch(err => console.log(err));
  async function main() {
    console.log(req.user.id);
    const user = await User.findOne({ _id: req.user.id }).exec();
    if(user){
      user.secret = submittedSecret;
      user.save();
      res.redirect("/secrets");
    }
  }
})



app.post("/register",function (req,res) {

  User.register({username : req.body.username}, req.body.password, function (err, user) {
    if(err){
      console.log(err);
      res.redirect("/register");
    }else{
      passport.authenticate("local")(req, res, function () {
        res.redirect("/secrets");
      })
    }
  })


});

app.get("/logout", function (req, res, next) {
  req.logout(function (err) {
    if(err){
      return next(err);
    }
    res.redirect("/");
  })
  
});

app.post("/login",function (req,res) {
    const user = new User({
      username : req.body.username,
      password : req.body.password
    });

    req.login(user, function (err) {
      if(err){
        console.log(err);
      }else{
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        })
      }
    })
});

app.listen(3000, function() {
  console.log("Server started on port 3000");
});