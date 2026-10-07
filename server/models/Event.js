const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    capacity: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
},
    { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);