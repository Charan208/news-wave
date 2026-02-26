const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pairingKey: { type: String, required: true },
    keys: { type: Map, of: String, default: {} }
}, { timestamps: true });

const historySchema = new mongoose.Schema({
    userId: { type: String, required: true },
    articles: { type: Array, default: [] },
    summary: { type: String },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

const recipientSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    phone: { type: String, required: true },
    name: { type: String },
    active: { type: Boolean, default: true },
    lastSent: { type: Date },
    sentCount: { type: Number, default: 0 }
}, { timestamps: true });

// Indexes for performance
historySchema.index({ userId: 1, timestamp: -1 });
recipientSchema.index({ userId: 1, phone: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);
const History = mongoose.model('History', historySchema);
const Recipient = mongoose.model('Recipient', recipientSchema);

module.exports = { User, History, Recipient };
