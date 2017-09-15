var express = require("express");
var app = express();
var path = require("path");
var mongoose = require("mongoose");
var session = require("session");
var flash = require("flash");
var async = require("async");
var bodyParser = require("body-parser");
var methodOverride = require("method-override");

mongoose.Promise = global.Promise;
//"mongodb://halbae76:halbae76@ds133084.mlab.com:33084/halbae76"
mongoose.connect(process.env.MONGO_DB, {
  useMongoClient: true
});
//mongoose.connect(process.env.MONGO_DB);
var db = mongoose.connection;

db.once("open", function () {
  console.log("DB connected!");
});

db.on("error", function (err) {
  console.log("DB error:", err);
});



var bcrypt = require("bcrypt-nodejs");

var userSchema = mongoose.Schema({
  email: {type: String, required: true, unique: true},
  nickname: {type: String, required: true, unique: true},
  password: {type: String, required: true},
  createdAt: {type: Date, default: Date.now}
});

userSchema.pre("save", function (next) {
  var user = this;

  if (user.isModified("password")) {
    user.password = bcrypt.hashSync(user.password);
  }

  return next();
});

userSchema.methods.authenticate = function (password) {
  var user = this;
  return bcrypt.compareSync(password, user.password);
};

userSchema.methods.hash = function (password) {
  return bcrypt.hashSync(password);
};



app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.use(flash());

app.use(session({secret: "MySecret"}));
app.use(passport.initialize());
app.use(passport.session());






app.get("/", function (req, res) {
  res.redirect("/posts");
});

app.get("/login", function (req, res) {
  res.render("login/login",
    {eamil:req.flash("email")[0], loginError:req.flash("loginError")});
});

app.post("login",
  function (req, res, next) {
    req.flash("email");

    if (req.body.email.length === 0 || req.body.password.length === 0) {
      req.flash("email", req.body.email);
      req.flash("loginError", "Please enter email and password.");
      res.redirect("/login");
    } else {
      next();
    }
  },
  passport.authenticate("local-login", {
    successRedirect: "/posts",
    failureRedirect: "/login",
    failureFlash: true
  })
);

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

///users/new
app.get("/users/new", function (req, res) {
  res.render("users/new", {
    formData: req.flash("formData")[0],
    emailError: req.flash("emailError")[0],
    nicknameError: req.flash("nicknameError")[0],
    passwordError: req.flash("passwordError")[0]
  });
});

///users/create
app.post("/users", checkUserRegValidation, function (req, res, next) {
  User.create(req.body.user, function (err, user) {
    if (err) {
      return res.json({success: false, message: err});
    }

    res.redirect("/login");
  });
});

///users/show
app.get("/users/:id", isLoggedIn, function (req, res) {
  User.findById(req.params.id, function (err, user) {
    if (err) {
      return res.json({success: false, message: err});
    }

    res.render("users/show", {user: user});
  });
});

///users/edir
app.get("/users/:id/edit", isLoggedIn, function (req, res) {
  User.findById(req.params.id, function (err, user) {
    if (err) {
      return res.json({success: false, message: err});
    }

    res.render("users/edit", {
      user: user,
      formData: req.flash("formData")[0],
      emailError: req.flash("emailError")[0],
      nicknameError: req.flash("nicknameError")[0],
      passwordError: req.flash("passwordError")[0]
    });
  });
});

///users/update
app.put("/users/:id", isLoggedIn, checkUserRegValidation, function (req, res) {
  User.findById(req.params.id, req.body.user, function (err, user) {
    if (err) {
      return res.json({success: false, message: err});
    }

    if (user.authenticate(req.body.user.password)) {
      if (req.body.user.newPassword) {
        req.body.user.password = user.hash(req.body.user.newPassword);
        user.save();
      } else {
        delete req.body.user.password;
      }

      User.findByIdAndUpdate(req.params.id, req.body.user, function (err, user) {
        if (err) {
          return res.json({success: false, message: err});
        }

        res.redirect("/users/" + req.params.id);
      });
    } else {
      req.flash("formData", req.body.user);
      req.flash("passwordError", "- Invaild password");
      res.redirect("/users/" + req.params.id + "/edit");
    }
  });
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  res.redirect("/");
}

function checkUserRegValidation(req, res, next) {
  var isValid = true;

  async.waterfall(
    [function (callback) {
      User.findOne({email: req.body.user.email, _id: {$ne: mongoose.Types.ObjectId(req.params.id)}},
        function (err, user) {
          if (user) {
            isValid = false;
            req.flash("emailError", "- This email is already registered.");
          }
          callback(null, isValid);
      });
    }, function (isValid, callback) {
      User.findOne({nickname: req.body.user.nickname, _id: {$ne: mongoose.Types.ObjectId(req.params.id)}},
        function (err, user) {
          if (user) {
            isValid = false;
            req.flash("nicknameError", "- This nickname is already registered.");
          }
          callback(null, isValid);
        });
    }], function (err, isValid) {
      if (err) {
        return res.json({success: false, message: err});
      }

      if (isValid) {
        return next();
      } else {
        req.flash("formData", req.body.user);
        res.redirect("back");
      }
    });
}




//index
app.get("/posts", function (req, res) {
  Post.find({}).populate("author").sort("-createdAt").exec(function (err, posts) {
    if (err) {
      return res.json({success: false, message: err});
    }

    res.render("posts/index", {posts: posts, user: req.user});
  });
});

//new
app.get("/posts/new", isLoggedIn, function (req, res) {
  res.render("posts/new");
});

//create
app.post("/posts", isLoggedIn, function (req, res) {
  Post.create(req.body.post, function(err, post) {
    if (err) {
      return res.json({success: false, message: err});
    }

    res.redirect("/posts");
  });
});

//show
app.get("/posts/:id", function (req, res) {
  Post.findById(req.params.id).populate("author").exec(function(err, post) {
    if (err) {
      return res.json({success: false, message: err});
    }

    res.render("posts/show", {post:post, user:req.user});
  });
});

//edit
app.get("/posts/:id/edit", isLoggedIn, function (req, res) {
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
app.put("/posts/:id", isLoggedIn, function (req, res) {
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
app.delete("/posts/:id", function (req, res) {
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

app.listen(3000, function() {
  console.log("Server On!");
});
