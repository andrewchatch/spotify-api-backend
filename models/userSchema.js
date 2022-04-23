const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: String,
    id: String,
}, {timestamps: true});

module.exports = userSchema;