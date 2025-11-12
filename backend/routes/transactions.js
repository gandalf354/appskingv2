const express = require('express');
const multer = require('multer');
const path = require('path');
const { executeQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Configure multer for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/receipts/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Only JPEG, PNG and PDF files are allowed!');
    }
  }
});

// Get all transactions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      type, 
      category_id, 
      project_id, 
      payment_method_id,
      start_date,
      end_date,
      page = 1, 
      limit = 20 
    } = req.query;
    
    console.log('Transaction query params:', { type, category_id, project_id, payment_method_id, start_date, end_date, page, limit });
    
    // Parse numeric values early
    const parsedLimit = parseInt(limit) || 20;
    const parsedPage = parseInt(page) || 1;
    const offset = (parsedPage - 1) * parsedLimit;

    let query = `
      SELECT t.*, 
             tc.name as category_name, tc.color as category_color,
             pm.name as payment_method_name,
             p.name as project_name
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ' AND t.type = ?';
      params.push(type);
    }

    if (category_id) {
      query += ' AND t.category_id = ?';
      params.push(parseInt(category_id));
    }

    if (project_id) {
      query += ' AND t.project_id = ?';
      params.push(parseInt(project_id));
    }

    if (payment_method_id) {
      query += ' AND t.payment_method_id = ?';
      params.push(parseInt(payment_method_id));
    }

    if (start_date && start_date !== '') {
      query += ' AND t.transaction_date >= ?';
      params.push(start_date);
    }

    if (end_date && end_date !== '') {
      query += ' AND t.transaction_date <= ?';
      params.push(end_date);
    }

    // Use string interpolation for LIMIT and OFFSET (safe because already parsed as integers)
    query += ` ORDER BY t.transaction_date DESC, t.created_at DESC LIMIT ${parsedLimit} OFFSET ${offset}`;

    console.log('Final query params count:', params.length);
    console.log('Query placeholders:', (query.match(/\?/g) || []).length);
    console.log('Params values:', params);
    console.log('Limit value:', parsedLimit, 'Offset value:', offset);

    const transactions = await executeQuery(query, params);

    // Get transaction items for each transaction
    for (let transaction of transactions) {
      const items = await executeQuery(
        'SELECT * FROM transaction_items WHERE transaction_id = ? ORDER BY id',
        [transaction.id]
      );
      
      if (items && items.length > 0) {
        // Format items as string in the expected format
        transaction.items = items.map(item => 
          `${item.item_name} - Qty: ${item.quantity} - Harga: Rp ${new Intl.NumberFormat('id-ID').format(item.unit_price)} - Subtotal: Rp ${new Intl.NumberFormat('id-ID').format(item.total_price)}`
        ).join('\n');
      } else {
        transaction.items = null;
      }
    }

    // Format transaction_date to YYYY-MM-DD for all transactions to avoid timezone issues
    const formattedTransactions = transactions.map(t => {
      if (t.transaction_date) {
        const date = new Date(t.transaction_date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        t.transaction_date = `${year}-${month}-${day}`;
      }
      return t;
    });

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM transactions WHERE 1=1';
    const countParams = [];

    if (type) {
      countQuery += ' AND type = ?';
      countParams.push(type);
    }

    if (category_id) {
      countQuery += ' AND category_id = ?';
      countParams.push(parseInt(category_id));
    }

    if (project_id) {
      countQuery += ' AND project_id = ?';
      countParams.push(parseInt(project_id));
    }

    if (payment_method_id) {
      countQuery += ' AND payment_method_id = ?';
      countParams.push(parseInt(payment_method_id));
    }

    if (start_date && start_date !== '') {
      countQuery += ' AND transaction_date >= ?';
      countParams.push(start_date);
    }

    if (end_date && end_date !== '') {
      countQuery += ' AND transaction_date <= ?';
      countParams.push(end_date);
    }

    const countResult = await executeQuery(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      transactions: formattedTransactions,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit)
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get single transaction
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const transactions = await executeQuery(`
      SELECT t.*, 
             tc.name as category_name, tc.color as category_color,
             pm.name as payment_method_name,
             p.name as project_name
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
    `, [req.params.id]);

    if (transactions.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Get transaction items
    const items = await executeQuery(
      'SELECT * FROM transaction_items WHERE transaction_id = ? ORDER BY id',
      [req.params.id]
    );

    // Format transaction_date to YYYY-MM-DD to avoid timezone issues
    const transactionData = { ...transactions[0] };
    if (transactionData.transaction_date) {
      const date = new Date(transactionData.transaction_date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      transactionData.transaction_date = `${year}-${month}-${day}`;
    }

    const transaction = {
      ...transactionData,
      items
    };

    res.json(transaction);

  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// Create new transaction
router.post('/', authenticateToken, upload.single('receipt'), async (req, res) => {
  try {
    console.log('=== CREATE TRANSACTION REQUEST ===');
    console.log('Body:', req.body);
    console.log('User ID:', req.user.id);
    
    const {
      type,
      amount,
      description,
      date, // Frontend sends 'date' not 'transaction_date'
      category_id,
      project_id,
      payment_method_id,
      reference_number,
      notes,
      items // JSON string of items array
    } = req.body;

    // Use 'date' as transaction_date for database insertion
    const transaction_date = date;

    if (!type || !amount || !transaction_date) {
      console.log('Validation failed:', { type, amount, transaction_date });
      return res.status(400).json({ error: 'Type, amount, and date are required' });
    }

    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: 'Type must be income or expense' });
    }

    // Generate transaction code
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const transaction_code = `TRX-${timestamp}-${randomStr}`;

    let receipt_path = null;
    if (req.file) {
      receipt_path = req.file.path;
    }

    // Set default category_id if not provided
    let finalCategoryId = category_id;
    let finalDescription = description;
    
    if (!finalCategoryId || finalCategoryId === '') {
      // Get default category based on type
      const defaultCategory = await executeQuery(
        'SELECT id, name FROM transaction_categories WHERE type = ? LIMIT 1',
        [type]
      );
      if (defaultCategory.length > 0) {
        finalCategoryId = defaultCategory[0].id;
        if (!finalDescription) {
          finalDescription = defaultCategory[0].name;
        }
        console.log('Using default category:', finalCategoryId);
      } else {
        return res.status(400).json({ error: 'Category is required' });
      }
    } else if (finalCategoryId === 'gaji' || finalCategoryId === 'lainnya') {
      // Handle hardcoded category values from frontend (legacy support)
      const categoryMap = {
        'gaji': 'Gaji',
        'lainnya': 'Lainnya'
      };
      const categoryName = categoryMap[finalCategoryId];
      const categoryInDb = await executeQuery(
        'SELECT id FROM transaction_categories WHERE name = ? AND type = ?',
        [categoryName, type]
      );
      if (categoryInDb.length > 0) {
        finalCategoryId = categoryInDb[0].id;
        if (!finalDescription) {
          finalDescription = categoryName;
        }
      } else {
        return res.status(400).json({ error: 'Category not found' });
      }
    } else {
      // Convert to integer if it's a numeric string
      finalCategoryId = parseInt(finalCategoryId, 10);
      
      if (!finalDescription) {
        // Get category name for description if not provided
        const categoryData = await executeQuery(
          'SELECT name FROM transaction_categories WHERE id = ?',
          [finalCategoryId]
        );
        if (categoryData.length > 0) {
          finalDescription = categoryData[0].name;
        }
      }
    }

    // Set default payment_method_id if not provided
    let finalPaymentMethodId = payment_method_id;
    if (!finalPaymentMethodId || finalPaymentMethodId === '') {
      // Get default payment method (Cash)
      const defaultPaymentMethod = await executeQuery(
        'SELECT id FROM payment_methods WHERE type = ? LIMIT 1',
        ['cash']
      );
      if (defaultPaymentMethod.length > 0) {
        finalPaymentMethodId = defaultPaymentMethod[0].id;
        console.log('Using default payment method:', finalPaymentMethodId);
      } else {
        return res.status(400).json({ error: 'Payment method is required' });
      }
    }

    console.log('Final transaction data:', {
      transaction_code,
      created_by: req.user.id,
      type,
      amount,
      description: finalDescription,
      transaction_date,
      category_id: finalCategoryId,
      project_id,
      payment_method_id: finalPaymentMethodId
    });

    // Insert transaction
    const result = await executeQuery(`
      INSERT INTO transactions (
        transaction_code, created_by, type, amount, description, transaction_date, 
        category_id, project_id, payment_method_id,
        reference_number, receipt_file, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      transaction_code, req.user.id, type, amount, finalDescription, transaction_date,
      finalCategoryId, project_id || null, finalPaymentMethodId,
      reference_number || null, receipt_path, notes || null
    ]);

    console.log('Transaction created successfully, ID:', result.insertId);

    const transactionId = result.insertId;

    // Insert transaction items if provided
    console.log('=== ITEMS PARAMETER CHECK ===');
    console.log('items received:', items);
    console.log('items type:', typeof items);
    console.log('items exists:', !!items);
    
    if (items) {
      console.log('✅ Items parameter exists, attempting to parse...');
      try {
        const itemsArray = JSON.parse(items);
        console.log('✅ Items parsed successfully:', itemsArray);
        console.log('Items array length:', itemsArray.length);
        console.log('Is array:', Array.isArray(itemsArray));
        
        if (Array.isArray(itemsArray) && itemsArray.length > 0) {
          console.log('✅ Starting items insertion...');
          for (const item of itemsArray) {
            console.log('Inserting item:', item);
            await executeQuery(`
              INSERT INTO transaction_items (transaction_id, item_name, quantity, unit, unit_price, total_price)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [
              transactionId, 
              item.item_name,    // Frontend sends 'item_name', matches DB column
              item.quantity, 
              item.unit || 'Buah',  // Frontend sends 'unit'
              item.unit_price, 
              item.subtotal      // Frontend sends 'subtotal', maps to 'total_price'
            ]);
            console.log('✅ Item inserted successfully');
          }
          console.log(`✅ Inserted ${itemsArray.length} transaction items`);
        } else {
          console.log('⚠️ Items array is empty or not an array');
        }
      } catch (parseError) {
        console.error('❌ Error parsing items:', parseError);
        console.error('Items value that failed to parse:', items);
      }
    } else {
      console.log('⚠️ No items parameter received');
    }

    // Save audit log if user role is 'user' and transaction_date > 2 days from now
    if (req.user.role === 'user') {
      try {
        const transactionDateObj = new Date(transaction_date);
        const currentDate = new Date();
        
        // Set time to 00:00:00 for accurate day comparison
        transactionDateObj.setHours(0, 0, 0, 0);
        currentDate.setHours(0, 0, 0, 0);
        
        const diffTime = transactionDateObj - currentDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        console.log('=== AUDIT LOG CHECK ===');
        console.log('Transaction date:', transaction_date);
        console.log('Current date:', currentDate.toISOString().split('T')[0]);
        console.log('Diff days:', diffDays);
        console.log('User role:', req.user.role);
        
        if (diffDays > 2) {
          const changesText = `Transaksi dibuat dengan tanggal ${diffDays} hari dari sekarang`;
          await executeQuery(`
            INSERT INTO audit_logs (user_id, user_name, user_email, action_type, transaction_id, transaction_date, changes)
            VALUES (?, ?, ?, 'CREATE', ?, ?, ?)
          `, [
            req.user.id,
            req.user.name,
            req.user.email,
            transactionId,
            transaction_date,
            changesText
          ]);
          console.log('✅ Audit log created for future-dated transaction by user:', req.user.name);
        }
      } catch (auditError) {
        console.error('❌ Failed to create audit log:', auditError);
        // Don't fail the main transaction if audit logging fails
      }
    }

    res.status(201).json({
      message: 'Transaction created successfully',
      transactionId,
      receipt_uploaded: !!req.file
    });

  } catch (error) {
    console.error('=== CREATE TRANSACTION ERROR ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to create transaction',
      details: error.message 
    });
  }
});

// Update transaction
router.put('/:id', authenticateToken, upload.single('receipt'), async (req, res) => {
  try {
    const {
      type,
      amount,
      description,
      date,
      category_id,
      project_id,
      payment_method_id,
      reference_number,
      notes,
      items
    } = req.body;

    // Check if transaction exists and get current data for audit logging
    const existingTransaction = await executeQuery(`
      SELECT t.*, 
             tc.name as category_name,
             pm.name as payment_method_name,
             p.name as project_name
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
    `, [req.params.id]);

    if (existingTransaction.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const oldData = existingTransaction[0];

    // Get category and payment method names for new data
    let newCategoryName = oldData.category_name;
    if (category_id && category_id !== oldData.category_id) {
      const categoryData = await executeQuery(
        'SELECT name FROM transaction_categories WHERE id = ?',
        [category_id]
      );
      if (categoryData.length > 0) {
        newCategoryName = categoryData[0].name;
      }
    }

    let newPaymentMethodName = oldData.payment_method_name;
    if (payment_method_id && payment_method_id !== oldData.payment_method_id) {
      const pmData = await executeQuery(
        'SELECT name FROM payment_methods WHERE id = ?',
        [payment_method_id]
      );
      if (pmData.length > 0) {
        newPaymentMethodName = pmData[0].name;
      }
    }

    let newProjectName = oldData.project_name;
    if (project_id && project_id !== oldData.project_id) {
      const projectData = await executeQuery(
        'SELECT name FROM projects WHERE id = ?',
        [project_id]
      );
      if (projectData.length > 0) {
        newProjectName = projectData[0].name;
      }
    }

    // Track changes for audit log (only for role=user)
    const changes = [];
    
    if (type && type !== oldData.type) {
      changes.push(`Tipe: ${oldData.type === 'income' ? 'Pemasukan' : 'Pengeluaran'} → ${type === 'income' ? 'Pemasukan' : 'Pengeluaran'}`);
    }
    
    if (amount && parseFloat(amount) !== parseFloat(oldData.amount)) {
      changes.push(`Jumlah: Rp ${new Intl.NumberFormat('id-ID').format(oldData.amount)} → Rp ${new Intl.NumberFormat('id-ID').format(amount)}`);
    }
    
    if (description && description !== oldData.description) {
      changes.push(`Deskripsi: "${oldData.description}" → "${description}"`);
    }
    
    if (date) {
      const oldDate = new Date(oldData.transaction_date);
      const newDate = new Date(date);
      const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (formatDate(oldDate) !== formatDate(newDate)) {
        changes.push(`Tanggal: ${formatDate(oldDate)} → ${formatDate(newDate)}`);
      }
    }
    
    if (category_id && parseInt(category_id) !== parseInt(oldData.category_id)) {
      changes.push(`Kategori: ${oldData.category_name} → ${newCategoryName}`);
    }
    
    if (payment_method_id && parseInt(payment_method_id) !== parseInt(oldData.payment_method_id)) {
      changes.push(`Metode Pembayaran: ${oldData.payment_method_name} → ${newPaymentMethodName}`);
    }
    
    if (project_id && parseInt(project_id) !== parseInt(oldData.project_id || 0)) {
      changes.push(`Proyek: ${oldData.project_name || 'Tidak ada'} → ${newProjectName || 'Tidak ada'}`);
    }
    
    if (reference_number && reference_number !== oldData.reference_number) {
      changes.push(`No. Referensi: ${oldData.reference_number || '-'} → ${reference_number}`);
    }

    let receipt_path = oldData.receipt_file;
    if (req.file) {
      receipt_path = req.file.path;
    }

    // Update transaction
    await executeQuery(`
      UPDATE transactions SET 
        type = ?, amount = ?, description = ?, transaction_date = ?,
        category_id = ?, project_id = ?, payment_method_id = ?,
        reference_number = ?, receipt_file = ?, notes = ?
      WHERE id = ?
    `, [
      type, amount, description, date,
      category_id, project_id, payment_method_id,
      reference_number, receipt_path, notes,
      req.params.id
    ]);

    // Update transaction items
    console.log('=== UPDATE ITEMS PARAMETER CHECK ===');
    console.log('items received:', items);
    console.log('items type:', typeof items);
    
    // Get old items for audit comparison
    const oldItems = await executeQuery(
      'SELECT * FROM transaction_items WHERE transaction_id = ? ORDER BY id',
      [req.params.id]
    );
    
    let itemChanges = [];
    
    if (items) {
      try {
        console.log('✅ Items parameter exists for update, attempting to parse...');
        const itemsArray = JSON.parse(items);
        console.log('✅ Items parsed successfully:', itemsArray);
        console.log('Items array length:', itemsArray.length);
        
        // Track item changes for audit (only if user role)
        if (req.user.role === 'user' && itemsArray.length > 0) {
          // Compare old vs new items
          const oldItemsMap = oldItems.map(item => ({
            name: item.item_name,
            qty: parseFloat(item.quantity),
            unit: item.unit,
            price: parseFloat(item.unit_price),
            subtotal: parseFloat(item.total_price)
          }));
          
          const newItemsMap = itemsArray.map(item => ({
            name: item.item_name,
            qty: parseFloat(item.quantity),
            unit: item.unit || 'Buah',
            price: parseFloat(item.unit_price),
            subtotal: parseFloat(item.subtotal)
          }));
          
          // Check for added items
          newItemsMap.forEach((newItem, index) => {
            if (index >= oldItemsMap.length) {
              itemChanges.push(`TAMBAH_ITEM::${newItem.name}||${newItem.qty}||${newItem.unit}||${newItem.price}||${newItem.subtotal}`);
            }
          });
          
          // Check for modified items
          oldItemsMap.forEach((oldItem, index) => {
            if (index < newItemsMap.length) {
              const newItem = newItemsMap[index];
              const itemChanged = 
                oldItem.name !== newItem.name ||
                oldItem.qty !== newItem.qty ||
                oldItem.unit !== newItem.unit ||
                oldItem.price !== newItem.price ||
                oldItem.subtotal !== newItem.subtotal;
              
              if (itemChanged) {
                itemChanges.push(
                  `UBAH_ITEM::${oldItem.name}||${oldItem.qty}||${oldItem.unit}||${oldItem.price}||${oldItem.subtotal}` +
                  `>>>${newItem.name}||${newItem.qty}||${newItem.unit}||${newItem.price}||${newItem.subtotal}`
                );
              }
            }
          });
          
          // Check for removed items
          if (oldItemsMap.length > newItemsMap.length) {
            for (let i = newItemsMap.length; i < oldItemsMap.length; i++) {
              const removedItem = oldItemsMap[i];
              itemChanges.push(`HAPUS_ITEM::${removedItem.name}||${removedItem.qty}||${removedItem.unit}||${removedItem.price}||${removedItem.subtotal}`);
            }
          }
        }
        
        // Delete existing items
        await executeQuery('DELETE FROM transaction_items WHERE transaction_id = ?', [req.params.id]);
        console.log('✅ Deleted existing items for transaction:', req.params.id);
        
        // Insert new items with correct field mapping (same as POST)
        if (Array.isArray(itemsArray) && itemsArray.length > 0) {
          for (const item of itemsArray) {
            console.log('Inserting updated item:', item);
            await executeQuery(`
              INSERT INTO transaction_items (transaction_id, item_name, quantity, unit, unit_price, total_price)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [
              req.params.id, 
              item.item_name,           // Frontend sends 'item_name', matches DB column
              item.quantity, 
              item.unit || 'Buah',      // Frontend sends 'unit'
              item.unit_price, 
              item.subtotal             // Frontend sends 'subtotal', maps to 'total_price'
            ]);
            console.log('✅ Updated item inserted successfully');
          }
          console.log(`✅ Updated ${itemsArray.length} transaction items`);
        }
      } catch (parseError) {
        console.error('❌ Error parsing/updating items:', parseError);
        console.error('Items value that failed:', items);
      }
    } else {
      console.log('⚠️ No items parameter received for update');
    }

    // Save audit log if user role is 'user' and there are changes
    if (req.user.role === 'user' && (changes.length > 0 || itemChanges.length > 0)) {
      try {
        // Combine regular changes and item changes
        const allChanges = [...changes, ...itemChanges];
        const changesText = allChanges.join(' | ');
        await executeQuery(`
          INSERT INTO audit_logs (user_id, user_name, user_email, action_type, transaction_id, transaction_date, changes)
          VALUES (?, ?, ?, 'EDIT', ?, ?, ?)
        `, [
          req.user.id,
          req.user.name,
          req.user.email,
          req.params.id,
          date || oldData.transaction_date,
          changesText
        ]);
        console.log('✅ Audit log created for transaction edit by user:', req.user.name);
      } catch (auditError) {
        console.error('❌ Failed to create audit log:', auditError);
        // Don't fail the main transaction if audit logging fails
      }
    }

    res.json({ 
      message: 'Transaction updated successfully',
      receipt_updated: !!req.file
    });

  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// Delete transaction
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Check if transaction exists
    const existingTransaction = await executeQuery(
      'SELECT id FROM transactions WHERE id = ?',
      [req.params.id]
    );

    if (existingTransaction.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Delete transaction (cascading deletes handled by foreign keys)
    await executeQuery(
      'DELETE FROM transactions WHERE id = ?',
      [req.params.id]
    );

    res.json({ message: 'Transaction deleted successfully' });

  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Get transaction summary
router.get('/summary/stats', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, project_id } = req.query;

    let query = `
      SELECT 
        type,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count
      FROM transactions 
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ' AND transaction_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND transaction_date <= ?';
      params.push(end_date);
    }

    if (project_id) {
      query += ' AND project_id = ?';
      params.push(project_id);
    }

    query += ' GROUP BY type';

    const summary = await executeQuery(query, params);

    const stats = {
      total_income: 0,
      total_expense: 0,
      income_count: 0,
      expense_count: 0,
      net_amount: 0
    };

    summary.forEach(row => {
      if (row.type === 'income') {
        stats.total_income = parseFloat(row.total_amount);
        stats.income_count = row.transaction_count;
      } else if (row.type === 'expense') {
        stats.total_expense = parseFloat(row.total_amount);
        stats.expense_count = row.transaction_count;
      }
    });

    stats.net_amount = stats.total_income - stats.total_expense;

    res.json(stats);

  } catch (error) {
    console.error('Get transaction summary error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction summary' });
  }
});

module.exports = router;