const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const passport = require('passport');
const refresh = require('passport-oauth2-refresh');
const userSchema = require('./models/userSchema');
const SpotifyStrategy = require('passport-spotify').Strategy;

require('dotenv').config();

const app = express();

mongoose.connect(process.env.MONGODB_CONNECT_URI);

const User = mongoose.model('User', userSchema);

const PORT = process.env.PORT || 8000;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

let access_token = '';
let refresh_token = '';

// Authentication middleware
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(404).send({error: 'You cannot access this content'});
  }

//Configure Strategy
const strategy = new SpotifyStrategy({
    clientID: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET,
    callbackURL: 'http://localhost:8000/auth/spotify/callback'
}, async (accessToken, refreshToken, expires_in, profile, done) => {
    try {

        access_token = accessToken;
        refresh_token = refreshToken;

        User.findOne({id: profile.id}, function(err, user) {

            if (err) {
                return done(err, false);
            }
            if (!user) {
                user = new User({
                    name: profile.display_name,
                    id: profile.id,
                });
                user.save();
                console.log(`User created with id ${profile.id}`);
                return done(err, user);
            } else {
                //found user. Return
                console.log(`User found with id ${profile.id}`);
                return done(err, user);
            }

        });

    }
    catch (err) {
        done(err, null, { msg: 'An error occurred while trying to authenticate the user'});
    }
})


passport.use(strategy);
refresh.use(strategy);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.deleteOne({id: id}, (err, user) => {
        done(err, user);
    })
});



//App Setup
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', 'http://localhost:3000');
    next();
});


app.use(express.json());
app.use(session({
    secret: 'random string here',
    cookie: {
        maxAge: 60 * 60 * 1000,
    },
    resave: true,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/login', ensureAuthenticated, (req, res) => {
    if(req.isAuthenticated())
    {
        res.send({message: 'You are logged in'});
    }
    else {
        res.send({message: 'You are not authenticated'});
    }
});

app.get('/logout', (req, res) => {
    req.logout();
    console.log('User has been logged out');
    res.redirect('http://localhost:3000/');
});


app.get('/auth/spotify', passport.authenticate('spotify', {
    scope: ['user-read-email', 'user-read-private', 'user-top-read', 'user-library-read', 'streaming', 'app-remote-control', 'user-read-playback-state', 'user-read-recently-played', 'user-modify-playback-state', 'user-library-modify', 'user-library-read'],
    showDialog: true
}));

app.get('/auth/spotify/callback', passport.authenticate('spotify', {
    failureRedirect: '/login',
    successRedirect: 'http://localhost:3000/#/auth'
}));

app.get('/auth/token', ensureAuthenticated, (req, res) => {
    res.json({
        access_token: access_token,
        refresh_token: refresh_token
    });
});

app.get('/refresh_token', (req, res) => {
    const refresh_token = req.query.refresh_token;
    refresh.requestNewAccessToken(
        'spotify',
        refresh_token,
        (err, access_token, refresh_token) => {
            if(err) {
                console.log(err);
            }
            access_token = access_token;
            refresh_token = refresh_token;
            res.status(200).send({access_token: access_token});
        }
    )

});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});