const router = require('express').Router();
const Event = require('../models/Event');
const auth = require('../middleware/auth');


router.post('/', auth('admin'), async (req, res) => {
    try {
        const { title, description, capacity, date } = req.body;
        const event = await Event.create({
            title, description, capacity, date,

            createdBy: req.user.id
        });
        res.status(201).json(event);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});



router.get('/', async (req, res) => {
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    const limit = Math.min(parseInt(req.query.limit) || 5, 50);

    const skip = (page - 1) * limit;
    const sort = req.query.sort === 'date' ? { date: 1 } : { createdAt: -1 };

    const filter = {};
    if (req.query.q) filter.title = { $regex: req.query.q, $options: 'i' };


    const [items, total] = await Promise.all([
        Event.find(filter).sort(sort).skip(skip).limit(limit),
        Event.countDocuments(filter)
    ]);
    res.json({ page, limit, total, items });
});



router.delete('/:id', auth('admin'), async (req, res) => {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

module.exports = router;