const router = require('express').Router();
const mongoose = require('mongoose');
const Event = require('../models/Event');

const Registration = require('../models/Registration');
const auth = require('../middleware/auth');


router.post('/:eventId', auth(), async (req, res) => {
  try {
  
    const event = await Event.findOneAndUpdate(

      { _id: req.params.eventId, $expr: { $lt: ['$registeredCount', '$capacity'] } },

      { $inc: { registeredCount: 1 } },
      { new: true }
    );
    if (!event) return res.status(409).json({ error: 'Event full or not found' });


    try {
      const reg = await Registration.create({ user: req.user.id, event: event._id });

      res.status(201).json(reg);
    } catch (err) {
      
      if (err.code === 11000) {
        await Event.updateOne({ _id: event._id }, { $inc: { registeredCount: -1 } });

        return res.status(409).json({ error: 'Already registered' });
      }
      throw err;
    }
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/event/:eventId', auth('admin'), async (req, res) => {
    
  const regs = await Registration.find({ event: req.params.eventId }).populate('user', 'name email');
  res.json(regs);
});

module.exports = router;