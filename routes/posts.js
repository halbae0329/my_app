var express = require("express");
var router = express.Router();
var mongoose = require("mongoose");
var Post = require("../models/Post");

//index
app.get("/", function (req, res) {
  Post.find({}).populate("author").sort("-createdAt").exec(function (err, posts) {
    if (err) {
      return res.json({success: false, message: err});
    }

    res.render("posts/index", {posts: posts, user: req.user});
  });
});

//new
app.get("/new", isLoggedIn, function (req, res) {
  res.render("posts/new");
});

//create
app.post("/", isLoggedIn, function (req, res) {
  Post.create(req.body.post, function(err, post) {
    if (err) {
      return res.json({success: false, message: err});
    }

    res.redirect("/posts");
  });
});

//show
app.get("/:id", function (req, res) {
  Post.findById(req.params.id).populate("author").exec(function(err, post) {
    if (err) {
      return res.json({success: false, message: err});
    }

    res.render("posts/show", {post:post, user:req.user});
  });
});

//edit
app.get("/:id/edit", isLoggedIn, function (req, res) {
  Post.findById(req.params.id, function (err, post) {
    if (err) {
      return res.json({success: false, message: err});
    }

    if (!req.user._id.equals(post.author)) {
      return res.json({success: false, message: "Unauthrized attempt"});
    }

    res.render("posts/edit", {post:post});
  });
});

//update
app.put("/:id", isLoggedIn, function (req, res) {
  req.body.post.updatedAt = Date.now();

  Post.findOneAndUpdate({_id: req.params.id, author: req.user._id}, req.body.post, function (err, post) {
    if (err) {
      return res.json({success: false, message: err});
    }

    if (!post) {
      return res.json({success: false, message: "No data found to update"});
    }

    res.redirect("/posts/" + req.params.id);
  });
});

//destroy
app.delete("/:id", function (req, res) {
  Post.findOneAndRemove({_id: req.params.id, author: req.user._id}, function (err, post) {
    if (err) {
      return res.json({success: false, message: err});
    }

    if (!post) {
      return res.json({success: false, message: "No data found to delete"});
    }

    res.redirect("/posts");
  });
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  res.redirect("/");
}

module.exports = router;
