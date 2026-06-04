const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  amount: {
    type: Number,
    required: true
  },
  month: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  dateAdded: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const Salary = mongoose.model('Salary', salarySchema);
module.exports = Salary;
