const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  monthlyLimit: {
    type: Number,
    required: true
  },
  categoryLimits: [{
    category: {
      type: String,
      required: true
    },
    limit: {
      type: Number,
      required: true
    }
  }],
  month: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  }
}, { timestamps: true });

const Budget = mongoose.model('Budget', budgetSchema);
module.exports = Budget;
