const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  amount: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Medical', 'Petrol', 'Grocery', 'Milk', 'Education', 'Home Tax', 'Electricity', 'Water Bill', 'Internet', 'Rent', 'EMI', 'Shopping', 'Entertainment', 'Travel', 'Others']
  },
  description: {
    type: String
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    required: true,
    default: 'Cash',
    enum: ['Cash', 'Credit Card', 'Debit Card', 'UPI', 'Net Banking']
  },
  receiptUrl: {
    type: String
  }
}, { timestamps: true });

const Expense = mongoose.model('Expense', expenseSchema);
module.exports = Expense;
