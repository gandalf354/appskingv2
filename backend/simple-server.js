const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Basic middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Database config
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_appsking'
};

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  console.log('🔐 Login request received:', req.body);
  
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Create database connection
    const connection = await mysql.createConnection(dbConfig);
    
    // Find user
    const [users] = await connection.execute(
      'SELECT id, email, password, name, role FROM users WHERE email = ?',
      [username]
    );

    await connection.end();

    if (users.length === 0) {
      console.log('❌ User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    console.log('👤 User found:', { id: user.id, email: user.email });

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('🔓 Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    console.log('🎫 Generating JWT token...');
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful for user:', user.email);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Projects endpoint
app.get('/api/projects', async (req, res) => {
  console.log('📋 Projects request received');
  
  try {
    // Extract auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No auth token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('👤 Token verified for user:', decoded.id);

    // Create database connection
    const connection = await mysql.createConnection(dbConfig);
    
    // Get projects for user
    const [projects] = await connection.execute(
      'SELECT p.*, pc.name as category_name, pc.color as category_color FROM projects p LEFT JOIN project_categories pc ON p.category_id = pc.id WHERE p.created_by = ? ORDER BY p.created_at DESC',
      [decoded.id]
    );

    await connection.end();

    console.log(`📊 Found ${projects.length} projects for user ${decoded.id}`);

    res.json({
      projects: projects,
      total: projects.length,
      page: 1,
      limit: 50
    });

  } catch (error) {
    console.error('❌ Projects error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create project endpoint
app.post('/api/projects', async (req, res) => {
  console.log('📝 Create project request received:', req.body);
  
  try {
    // Extract auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No auth token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('👤 Token verified for user:', decoded.id);

    const {
      name,
      description,
      category_id,
      budget,
      start_date,
      end_date,
      client_name,
      client_email,
      client_phone,
      status
    } = req.body;

    if (!name || !budget) {
      return res.status(400).json({ error: 'Name and budget are required' });
    }

    // Create database connection
    const connection = await mysql.createConnection(dbConfig);
    
    // Insert new project
    const [result] = await connection.execute(
      `INSERT INTO projects (
        name, description, category_id, budget, start_date, end_date, 
        client_name, client_email, client_phone, status, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        name,
        description || null,
        category_id || null,
        budget,
        start_date || null,
        end_date || null,
        client_name || null,
        client_email || null,
        client_phone || null,
        status || 'planning',
        decoded.id
      ]
    );

    // Get the created project with category info
    const [projects] = await connection.execute(
      `SELECT p.*, pc.name as category_name, pc.color as category_color 
       FROM projects p 
       LEFT JOIN project_categories pc ON p.category_id = pc.id 
       WHERE p.id = ?`,
      [result.insertId]
    );

    await connection.end();

    console.log('✅ Project created successfully:', result.insertId);

    res.status(201).json({
      message: 'Project created successfully',
      project: projects[0]
    });

  } catch (error) {
    console.error('❌ Create project error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update project endpoint
app.put('/api/projects/:id', async (req, res) => {
  console.log('📝 Update project request received:', req.params.id, req.body);
  
  try {
    // Extract auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No auth token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('👤 Token verified for user:', decoded.id);

    const {
      name,
      description,
      category_id,
      budget,
      start_date,
      end_date,
      client_name,
      client_email,
      client_phone,
      status
    } = req.body;

    const projectId = req.params.id;

    if (!name || !budget) {
      return res.status(400).json({ error: 'Name and budget are required' });
    }

    // Create database connection
    const connection = await mysql.createConnection(dbConfig);
    
    // Check if project exists and belongs to user
    const [existingProject] = await connection.execute(
      'SELECT created_by FROM projects WHERE id = ?',
      [projectId]
    );

    if (existingProject.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Project not found' });
    }

    if (existingProject[0].created_by !== decoded.id) {
      await connection.end();
      return res.status(403).json({ error: 'You are not authorized to update this project' });
    }

    // Update project
    const [result] = await connection.execute(
      `UPDATE projects SET 
        name = ?, description = ?, category_id = ?, budget = ?, 
        start_date = ?, end_date = ?, client_name = COALESCE(?, client_name), 
        client_email = COALESCE(?, client_email), 
        client_phone = COALESCE(?, client_phone), status = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        name,
        description || null,
        category_id || null,
        budget,
        start_date || null,
        end_date || null,
        client_name || null,
        client_email || null,
        client_phone || null,
        status || 'planning',
        projectId
      ]
    );

    // Get the updated project with category info
    const [projects] = await connection.execute(
      `SELECT p.*, pc.name as category_name, pc.color as category_color 
       FROM projects p 
       LEFT JOIN project_categories pc ON p.category_id = pc.id 
       WHERE p.id = ?`,
      [projectId]
    );

    await connection.end();

    console.log('✅ Project updated successfully:', projectId);

    res.json({
      message: 'Project updated successfully',
      project: projects[0]
    });

  } catch (error) {
    console.error('❌ Update project error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete project endpoint
app.delete('/api/projects/:id', async (req, res) => {
  console.log('🗑️ Delete project request received:', req.params.id);
  
  try {
    // Extract auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No auth token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('👤 Token verified for user:', decoded.id);

    const projectId = req.params.id;

    // Create database connection
    const connection = await mysql.createConnection(dbConfig);
    
    // Check if project exists and belongs to user
    const [existingProject] = await connection.execute(
      'SELECT created_by, name FROM projects WHERE id = ?',
      [projectId]
    );

    if (existingProject.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Project not found' });
    }

    if (existingProject[0].created_by !== decoded.id) {
      await connection.end();
      return res.status(403).json({ error: 'You are not authorized to delete this project' });
    }

    // Delete project
    const [result] = await connection.execute(
      'DELETE FROM projects WHERE id = ?',
      [projectId]
    );

    await connection.end();

    console.log('✅ Project deleted successfully:', projectId, existingProject[0].name);

    res.json({
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete project error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Categories endpoint
app.get('/api/categories', async (req, res) => {
  console.log('📂 Categories request received');
  
  try {
    // Extract auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No auth token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('👤 Token verified for user:', decoded.id);

    // Create database connection
    const connection = await mysql.createConnection(dbConfig);
    
    // Get categories
    const [categories] = await connection.execute(
      'SELECT * FROM project_categories ORDER BY name'
    );

    await connection.end();

    console.log(`📊 Found ${categories.length} categories`);

    res.json(categories);

  } catch (error) {
    console.error('❌ Categories error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create category endpoint
app.post('/api/categories', async (req, res) => {
  console.log('📝 Create category request received:', req.body);
  
  try {
    // Extract auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No auth token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('👤 Token verified for user:', decoded.id);

    const { name, description, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Create database connection
    const connection = await mysql.createConnection(dbConfig);
    
    // Insert new category
    const [result] = await connection.execute(
      `INSERT INTO project_categories (name, description, color, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, 1, NOW(), NOW())`,
      [name, description || null, color || '#3B82F6']
    );

    // Get the created category
    const [categories] = await connection.execute(
      'SELECT * FROM project_categories WHERE id = ?',
      [result.insertId]
    );

    await connection.end();

    console.log('✅ Category created successfully:', result.insertId);

    res.status(201).json({
      message: 'Category created successfully',
      category: categories[0]
    });

  } catch (error) {
    console.error('❌ Create category error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update category endpoint
app.put('/api/categories/:id', async (req, res) => {
  console.log('📝 Update category request received:', req.params.id, req.body);
  
  try {
    // Extract auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No auth token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('👤 Token verified for user:', decoded.id);

    const { name, description, color } = req.body;
    const categoryId = req.params.id;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Create database connection
    const connection = await mysql.createConnection(dbConfig);
    
    // Update category
    const [result] = await connection.execute(
      `UPDATE project_categories 
       SET name = ?, description = ?, color = ?, updated_at = NOW() 
       WHERE id = ?`,
      [name, description || null, color || '#3B82F6', categoryId]
    );

    if (result.affectedRows === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Category not found' });
    }

    // Get the updated category
    const [categories] = await connection.execute(
      'SELECT * FROM project_categories WHERE id = ?',
      [categoryId]
    );

    await connection.end();

    console.log('✅ Category updated successfully:', categoryId);

    res.json({
      message: 'Category updated successfully',
      category: categories[0]
    });

  } catch (error) {
    console.error('❌ Update category error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete category endpoint
app.delete('/api/categories/:id', async (req, res) => {
  console.log('🗑️ Delete category request received:', req.params.id);
  
  try {
    // Extract auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No auth token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('👤 Token verified for user:', decoded.id);

    const categoryId = req.params.id;

    // Create database connection
    const connection = await mysql.createConnection(dbConfig);
    
    // Check if category is being used by projects
    const [projects] = await connection.execute(
      'SELECT COUNT(*) as count FROM projects WHERE category_id = ?',
      [categoryId]
    );

    if (projects[0].count > 0) {
      await connection.end();
      return res.status(400).json({ 
        error: 'Cannot delete category that is being used by projects' 
      });
    }

    // Delete category
    const [result] = await connection.execute(
      'DELETE FROM project_categories WHERE id = ?',
      [categoryId]
    );

    await connection.end();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    console.log('✅ Category deleted successfully:', categoryId);

    res.json({
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete category error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  console.log('💓 Health check requested');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple Backend running on port ${PORT}`);
  console.log(`🔑 JWT_SECRET: ${process.env.JWT_SECRET ? 'SET' : 'NOT SET'}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});