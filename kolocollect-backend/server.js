const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const connectDB = require('./kolocollect-backend/config/db');

dotenv.config();

// Initialize express app
const app = express();

// Connect to the database
connectDB();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
const communityRoutes = require('./kolocollect-backend/routes/communityRoutes');
app.use('/api/communities', communityRoutes);

// Server listen
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
