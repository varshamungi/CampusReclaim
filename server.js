const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campusreclaim')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Multer Setup for Image Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 5000000 } });

// ========== SCHEMAS ==========

// User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  phone: String,
  password: String,
  registeredAt: { type: Date, default: Date.now }
});

// Item Schema (Lost or Found)
const itemSchema = new mongoose.Schema({
  title: String,
  description: String,
  category: String,
  status: { type: String, enum: ['lost', 'found'] },
  location: String,
  dateLostFound: Date,
  image: String,
  postedBy: mongoose.Schema.Types.ObjectId,
  email: String,
  phone: String,
  createdAt: { type: Date, default: Date.now },
  claimed: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);
const Item = mongoose.model('Item', itemSchema);

// ========== AUTHENTICATION ROUTES ==========

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({ name, email, phone, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name, email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ msg: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid password' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ITEM ROUTES ==========

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ msg: 'No token' });

  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, decoded) => {
    if (err) return res.status(401).json({ msg: 'Invalid token' });
    req.userId = decoded.userId;
    next();
  });
};

// Post Lost or Found Item
app.post('/api/items', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { title, description, category, status, location, dateLostFound, phone } = req.body;
    const user = await User.findById(req.userId);

    const item = new Item({
      title,
      description,
      category,
      status,
      location,
      dateLostFound,
      image: req.file ? req.file.filename : null,
      postedBy: req.userId,
      email: user.email,
      phone
    });

    await item.save();
    res.json({ msg: 'Item posted successfully', item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Items
app.get('/api/items', async (req, res) => {
  try {
    const { status, category } = req.query;
    let filter = {};
    
    if (status) filter.status = status;
    if (category) filter.category = category;

    const items = await Item.find(filter).populate('postedBy', 'name email').sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Single Item
app.get('/api/items/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('postedBy', 'name email phone');
    if (!item) return res.status(404).json({ msg: 'Item not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark Item as Claimed
app.put('/api/items/:id/claim', verifyToken, async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, { claimed: true }, { new: true });
    res.json({ msg: 'Item marked as claimed', item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Item
app.delete('/api/items/:id', verifyToken, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (item.postedBy.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    await Item.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));