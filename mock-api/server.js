const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.MOCK_API_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Users endpoints
app.get('/api/users', (req, res) => {
  const users = [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
    { id: 3, name: 'Bob Wilson', email: 'bob@example.com', role: 'user' }
  ];
  res.json({ data: users, total: users.length, page: 1, perPage: 10 });
});

app.get('/api/users/:id', (req, res) => {
  const users = {
    1: { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' },
    2: { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
    3: { id: 3, name: 'Bob Wilson', email: 'bob@example.com', role: 'user' }
  };
  const user = users[req.params.id];
  
  if (user) {
    res.json({ data: user });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.post('/api/users', (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  const newUser = {
    id: Math.floor(Math.random() * 10000),
    name,
    email,
    role: role || 'user',
    createdAt: new Date().toISOString()
  };
  
  res.status(201).json({ data: newUser, message: 'User created successfully' });
});

app.put('/api/users/:id', (req, res) => {
  const { name, email, role } = req.body;
  const user = {
    id: parseInt(req.params.id),
    name: name || 'Updated User',
    email: email || 'updated@example.com',
    role: role || 'user',
    updatedAt: new Date().toISOString()
  };
  
  res.json({ data: user, message: 'User updated successfully' });
});

app.delete('/api/users/:id', (req, res) => {
  res.status(200).json({ message: `User ${req.params.id} deleted successfully` });
});

// Posts endpoints
app.get('/api/posts', (req, res) => {
  const { page = 1, limit = 10, authorId } = req.query;
  const posts = [
    { id: 1, title: 'Getting Started with API Testing', content: 'Learn the basics...', authorId: 1, tags: ['api', 'testing'] },
    { id: 2, title: 'Advanced Bruno Features', content: 'Explore advanced features...', authorId: 2, tags: ['bruno', 'tutorial'] },
    { id: 3, title: 'REST vs GraphQL', content: 'Comparing approaches...', authorId: 1, tags: ['api', 'graphql'] }
  ];
  
  const filteredPosts = authorId ? posts.filter(p => p.authorId === parseInt(authorId)) : posts;
  const paginatedPosts = filteredPosts.slice((page - 1) * limit, page * limit);
  
  res.json({
    data: paginatedPosts,
    total: filteredPosts.length,
    page: parseInt(page),
    perPage: parseInt(limit)
  });
});

app.get('/api/posts/:id', (req, res) => {
  const posts = {
    1: { id: 1, title: 'Getting Started with API Testing', content: 'Learn the basics...', authorId: 1, tags: ['api', 'testing'] },
    2: { id: 2, title: 'Advanced Bruno Features', content: 'Explore advanced features...', authorId: 2, tags: ['bruno', 'tutorial'] },
    3: { id: 3, title: 'REST vs GraphQL', content: 'Comparing approaches...', authorId: 1, tags: ['api', 'graphql'] }
  };
  
  const post = posts[req.params.id];
  if (post) {
    res.json({ data: post });
  } else {
    res.status(404).json({ error: 'Post not found' });
  }
});

// Authentication endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (email === 'test@example.com' && password === 'password123') {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTY4MzAwMDAwMH0.mock-signature';
    res.json({ 
      data: { 
        token,
        user: { id: 1, name: 'Test User', email: 'test@example.com' }
      },
      message: 'Login successful'
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  res.status(201).json({
    data: { id: Math.floor(Math.random() * 10000), name, email, createdAt: new Date().toISOString() },
    message: 'Registration successful'
  });
});

// Error handling endpoints
app.get('/api/errors/400', (req, res) => {
  res.status(400).json({ error: 'Bad Request', message: 'Invalid parameters' });
});

app.get('/api/errors/401', (req, res) => {
  res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
});

app.get('/api/errors/403', (req, res) => {
  res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
});

app.get('/api/errors/404', (req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'Resource does not exist' });
});

app.get('/api/errors/500', (req, res) => {
  res.status(500).json({ error: 'Internal Server Error', message: 'Something went wrong' });
});

// Delay endpoint for testing loading states
app.get('/api/delay/:ms', (req, res) => {
  const ms = parseInt(req.params.ms) || 1000;
  setTimeout(() => {
    res.json({ message: 'Delay complete', requestedDelay: ms });
  }, ms);
});

// Search endpoint
app.get('/api/search', (req, res) => {
  const { q, type = 'all' } = req.query;
  const results = {
    users: [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
    ],
    posts: [
      { id: 1, title: 'Getting Started with API Testing', content: 'Learn the basics...' },
      { id: 2, title: 'Advanced Bruno Features', content: 'Explore advanced features...' }
    ]
  };
  
  let filtered = results;
  if (type === 'users') filtered = { users: results.users.filter(u => u.name.toLowerCase().includes(q.toLowerCase())) };
  if (type === 'posts') filtered = { posts: results.posts.filter(p => p.title.toLowerCase().includes(q.toLowerCase())) };
  
  res.json({ data: filtered, query: q, type });
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  res.json({
    totalUsers: 150,
    totalPosts: 450,
    activeUsers: 89,
    newUsersToday: 12,
    totalRequests: 12500,
    activeSessions: 45
  });
});

// File upload simulation (returns mock file info)
app.post('/api/upload', (req, res) => {
  res.json({
    fileName: 'mock-upload.txt',
    fileSize: 1024,
    fileType: 'text/plain',
    uploadedAt: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Mock API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
