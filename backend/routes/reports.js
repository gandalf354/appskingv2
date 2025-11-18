const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Summary pemasukan/pengeluaran per kategori untuk 1 project
router.get('/cashflow/project-category-summary', authenticateToken, async (req, res) => {
  try {
    const { project_id, start_date, end_date } = req.query;
    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    // Query pengeluaran per reference_number
    let expenseQuery = `
      SELECT t.reference_number, SUM(t.amount) as total_amount, count(t.reference_number) as jumlah
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id 
      WHERE t.description='Pengeluaran' and t.project_id = ?
    `;
    const expenseParams = [project_id];
    if (start_date) {
      expenseQuery += ' AND t.transaction_date >= ?';
      expenseParams.push(start_date);
    }
    if (end_date) {
      expenseQuery += ' AND t.transaction_date <= ?';
      expenseParams.push(end_date);
    }
    expenseQuery += ' GROUP BY tc.name, t.type, t.reference_number ORDER BY tc.name ASC, t.reference_number ASC';

    const expenseResults = await executeQuery(expenseQuery, expenseParams);
    const expense = expenseResults.map(row => ({
      reference_number: row.reference_number || null,
      total_amount: parseFloat(row.total_amount) || 0,
      jumlah: parseInt(row.jumlah) || 0
    }));

    // Query pemasukan per kategori
    let incomeQuery = `
      SELECT tc.name as category_name, SUM(t.amount) as total_amount, count(t.id) as jumlah
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id 
      WHERE t.type='income' and t.project_id = ?
    `;
    const incomeParams = [project_id];
    if (start_date) {
      incomeQuery += ' AND t.transaction_date >= ?';
      incomeParams.push(start_date);
    }
    if (end_date) {
      incomeQuery += ' AND t.transaction_date <= ?';
      incomeParams.push(end_date);
    }
    incomeQuery += ' GROUP BY tc.name ORDER BY tc.name ASC';

    const incomeResults = await executeQuery(incomeQuery, incomeParams);
    const income = incomeResults.map(row => ({
      category_name: row.category_name || null,
      total_amount: parseFloat(row.total_amount) || 0,
      jumlah: parseInt(row.jumlah) || 0
    }));

    res.json({ expense, income });
  } catch (error) {
    console.error('Get project category summary error:', error);
    res.status(500).json({ error: 'Failed to fetch project category summary' });
  }
});

// Get overall cashflow
router.get('/cashflow/overall', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `
      SELECT 
        type,
        SUM(amount) as total,
        COUNT(*) as count
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

    query += ' GROUP BY type';

    const results = await executeQuery(query, params);

    let total_income = 0;
    let total_expense = 0;
    let transaction_count = 0;

    results.forEach(row => {
      if (row.type === 'income') {
        total_income = parseFloat(row.total) || 0;
      } else if (row.type === 'expense') {
        total_expense = parseFloat(row.total) || 0;
      }
      transaction_count += parseInt(row.count) || 0;
    });

    res.json({
      total_income,
      total_expense,
      net_cashflow: total_income - total_expense,
      transaction_count
    });

  } catch (error) {
    console.error('Get overall cashflow error:', error);
    res.status(500).json({ error: 'Failed to fetch overall cashflow' });
  }
});

// Get cashflow per project
router.get('/cashflow/projects', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `
      SELECT 
        p.id as project_id,
        p.name as project_name,
        p.client_name,
        p.budget,
        SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) as total_income,
        SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) as total_expense,
        COUNT(t.id) as transaction_count
      FROM projects p
      LEFT JOIN transactions t ON p.id = t.project_id
    `;
    const params = [];

    let whereConditions = [];

    if (start_date) {
      whereConditions.push('(t.transaction_date >= ? OR t.transaction_date IS NULL)');
      params.push(start_date);
    }

    if (end_date) {
      whereConditions.push('(t.transaction_date <= ? OR t.transaction_date IS NULL)');
      params.push(end_date);
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += ' GROUP BY p.id, p.name, p.client_name HAVING transaction_count > 0 ORDER BY total_income DESC';

    const results = await executeQuery(query, params);

    const projectCashflows = results.map(row => ({
      project_id: row.project_id,
      project_name: row.project_name,
      client_name: row.client_name,
      budget: parseFloat(row.budget) || 0,
      total_income: parseFloat(row.total_income) || 0,
      total_expense: parseFloat(row.total_expense) || 0,
      net_cashflow: (parseFloat(row.total_income) || 0) - (parseFloat(row.total_expense) || 0),
      transaction_count: parseInt(row.transaction_count) || 0
    }));

    res.json(projectCashflows);

  } catch (error) {
    console.error('Get project cashflow error:', error);
    res.status(500).json({ error: 'Failed to fetch project cashflow' });
  }
});

// Generate financial report
router.get('/financial', authenticateToken, async (req, res) => {
  try {
    const { 
      start_date, 
      end_date, 
      format = 'summary', // summary, detailed
      project_id,
      category_id 
    } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    let query = `
      SELECT t.*, 
             tc.name as category_name, tc.color as category_color,
             pm.name as payment_method_name,
             p.name as project_name
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.user_id = ? AND t.date BETWEEN ? AND ?
    `;
    const params = [req.user.id, start_date, end_date];

    if (project_id) {
      query += ' AND t.project_id = ?';
      params.push(project_id);
    }

    if (category_id) {
      query += ' AND t.category_id = ?';
      params.push(category_id);
    }

    query += ' ORDER BY t.date DESC, t.created_at DESC';

    const transactions = await promiseQuery(query, params);

    // Calculate summary statistics
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryBreakdown = {};
    const projectBreakdown = {};
    const paymentMethodBreakdown = {};
    const monthlyBreakdown = {};

    transactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount);
      const month = transaction.date.toISOString().slice(0, 7);

      if (transaction.type === 'income') {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }

      // Category breakdown
      const categoryKey = transaction.category_name || 'Uncategorized';
      if (!categoryBreakdown[categoryKey]) {
        categoryBreakdown[categoryKey] = { income: 0, expense: 0, color: transaction.category_color };
      }
      categoryBreakdown[categoryKey][transaction.type] += amount;

      // Project breakdown
      if (transaction.project_name) {
        if (!projectBreakdown[transaction.project_name]) {
          projectBreakdown[transaction.project_name] = { income: 0, expense: 0 };
        }
        projectBreakdown[transaction.project_name][transaction.type] += amount;
      }

      // Payment method breakdown
      const pmKey = transaction.payment_method_name || 'Unknown';
      if (!paymentMethodBreakdown[pmKey]) {
        paymentMethodBreakdown[pmKey] = { income: 0, expense: 0 };
      }
      paymentMethodBreakdown[pmKey][transaction.type] += amount;

      // Monthly breakdown
      if (!monthlyBreakdown[month]) {
        monthlyBreakdown[month] = { income: 0, expense: 0 };
      }
      monthlyBreakdown[month][transaction.type] += amount;
    });

    const report = {
      period: { start_date, end_date },
      summary: {
        total_income: totalIncome,
        total_expense: totalExpense,
        net_amount: totalIncome - totalExpense,
        transaction_count: transactions.length
      },
      breakdown: {
        by_category: Object.entries(categoryBreakdown).map(([name, data]) => ({
          category: name,
          income: data.income,
          expense: data.expense,
          net: data.income - data.expense,
          color: data.color
        })),
        by_project: Object.entries(projectBreakdown).map(([name, data]) => ({
          project: name,
          income: data.income,
          expense: data.expense,
          net: data.income - data.expense
        })),
        by_payment_method: Object.entries(paymentMethodBreakdown).map(([name, data]) => ({
          payment_method: name,
          income: data.income,
          expense: data.expense,
          net: data.income - data.expense
        })),
        by_month: Object.entries(monthlyBreakdown).map(([month, data]) => ({
          month,
          income: data.income,
          expense: data.expense,
          net: data.income - data.expense
        })).sort((a, b) => a.month.localeCompare(b.month))
      }
    };

    if (format === 'detailed') {
      report.transactions = transactions;
    }

    res.json(report);

  } catch (error) {
    console.error('Generate financial report error:', error);
    res.status(500).json({ error: 'Failed to generate financial report' });
  }
});

// Generate project report
router.get('/project/:id', authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;

    // Get project details
    const projects = await promiseQuery(`
      SELECT p.*, pc.name as category_name, pc.color as category_color
      FROM projects p
      LEFT JOIN project_categories pc ON p.category_id = pc.id
      WHERE p.id = ? AND p.user_id = ?
    `, [projectId, req.user.id]);

    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projects[0];

    // Get project transactions
    const transactions = await promiseQuery(`
      SELECT t.*, 
             tc.name as category_name, tc.color as category_color,
             pm.name as payment_method_name
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
      WHERE t.project_id = ? AND t.user_id = ?
      ORDER BY t.date DESC
    `, [projectId, req.user.id]);

    // Get project milestones
    const milestones = await promiseQuery(`
      SELECT * FROM project_milestones 
      WHERE project_id = ? 
      ORDER BY due_date ASC
    `, [projectId]);

    // Calculate project statistics
    let totalIncome = 0;
    let totalExpense = 0;
    const monthlyData = {};

    transactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount);
      const month = transaction.date.toISOString().slice(0, 7);

      if (transaction.type === 'income') {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }

      if (!monthlyData[month]) {
        monthlyData[month] = { income: 0, expense: 0 };
      }
      monthlyData[month][transaction.type] += amount;
    });

    // Calculate milestone statistics
    const totalMilestones = milestones.length;
    const completedMilestones = milestones.filter(m => m.status === 'completed').length;
    const progressPercent = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

    // Budget analysis
    const budget = parseFloat(project.budget) || 0;
    const budgetUsed = budget > 0 ? (totalExpense / budget) * 100 : 0;
    const budgetRemaining = budget - totalExpense;

    const report = {
      project: {
        ...project,
        budget: budget
      },
      financial_summary: {
        total_income: totalIncome,
        total_expense: totalExpense,
        profit: totalIncome - totalExpense,
        profit_margin: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0
      },
      budget_analysis: {
        budget_amount: budget,
        budget_used: totalExpense,
        budget_remaining: budgetRemaining,
        budget_used_percent: budgetUsed,
        budget_status: budgetUsed > 100 ? 'over_budget' : budgetUsed > 80 ? 'near_budget' : 'under_budget'
      },
      milestone_progress: {
        total_milestones: totalMilestones,
        completed_milestones: completedMilestones,
        progress_percent: progressPercent,
        milestones: milestones
      },
      monthly_trend: Object.entries(monthlyData).map(([month, data]) => ({
        month,
        income: data.income,
        expense: data.expense,
        net: data.income - data.expense
      })).sort((a, b) => a.month.localeCompare(b.month)),
      transactions: transactions
    };

    res.json(report);

  } catch (error) {
    console.error('Generate project report error:', error);
    res.status(500).json({ error: 'Failed to generate project report' });
  }
});

// Generate tax report
router.get('/tax', authenticateToken, async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    // Get all transactions for the year
    const transactions = await promiseQuery(`
      SELECT t.*, 
             tc.name as category_name, tc.type as category_type,
             p.name as project_name
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.user_id = ? AND YEAR(t.date) = ?
      ORDER BY t.date ASC
    `, [req.user.id, year]);

    // Categorize transactions for tax purposes
    const taxableIncome = [];
    const deductibleExpenses = [];
    const businessExpenses = [];
    const personalExpenses = [];

    let totalIncome = 0;
    let totalDeductibleExpenses = 0;
    let totalBusinessExpenses = 0;

    transactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount);

      if (transaction.type === 'income') {
        totalIncome += amount;
        taxableIncome.push(transaction);
      } else if (transaction.type === 'expense') {
        // Categorize expenses (this would need more sophisticated logic based on category types)
        if (transaction.category_type === 'business' || transaction.project_name) {
          totalBusinessExpenses += amount;
          businessExpenses.push(transaction);
          
          // Some business expenses might be tax deductible
          totalDeductibleExpenses += amount;
          deductibleExpenses.push(transaction);
        } else {
          personalExpenses.push(transaction);
        }
      }
    });

    // Generate quarterly breakdown
    const quarterlyBreakdown = [1, 2, 3, 4].map(quarter => {
      const startMonth = (quarter - 1) * 3 + 1;
      const endMonth = quarter * 3;
      
      const quarterTransactions = transactions.filter(t => {
        const month = new Date(t.date).getMonth() + 1;
        return month >= startMonth && month <= endMonth;
      });

      const quarterIncome = quarterTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      const quarterExpenses = quarterTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      return {
        quarter,
        period: `Q${quarter} ${year}`,
        income: quarterIncome,
        expenses: quarterExpenses,
        net: quarterIncome - quarterExpenses
      };
    });

    const report = {
      tax_year: year,
      summary: {
        total_income: totalIncome,
        total_deductible_expenses: totalDeductibleExpenses,
        total_business_expenses: totalBusinessExpenses,
        taxable_income: totalIncome - totalDeductibleExpenses,
        estimated_tax_savings: totalDeductibleExpenses * 0.25 // Rough estimation
      },
      quarterly_breakdown: quarterlyBreakdown,
      categories: {
        taxable_income: {
          count: taxableIncome.length,
          total: totalIncome,
          transactions: taxableIncome
        },
        deductible_expenses: {
          count: deductibleExpenses.length,
          total: totalDeductibleExpenses,
          transactions: deductibleExpenses
        },
        business_expenses: {
          count: businessExpenses.length,
          total: totalBusinessExpenses,
          transactions: businessExpenses
        }
      }
    };

    res.json(report);

  } catch (error) {
    console.error('Generate tax report error:', error);
    res.status(500).json({ error: 'Failed to generate tax report' });
  }
});

// Export data
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { 
      type = 'transactions', // transactions, projects, all
      format = 'json', // json, csv
      start_date,
      end_date 
    } = req.query;

    let data = {};

    if (type === 'transactions' || type === 'all') {
      let query = `
        SELECT t.*, 
               tc.name as category_name,
               pm.name as payment_method_name,
               p.name as project_name
        FROM transactions t
        LEFT JOIN transaction_categories tc ON t.category_id = tc.id
        LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.user_id = ?
      `;
      const params = [req.user.id];

      if (start_date) {
        query += ' AND t.date >= ?';
        params.push(start_date);
      }

      if (end_date) {
        query += ' AND t.date <= ?';
        params.push(end_date);
      }

      query += ' ORDER BY t.date DESC';
      data.transactions = await promiseQuery(query, params);
    }

    if (type === 'projects' || type === 'all') {
      data.projects = await promiseQuery(`
        SELECT p.*, pc.name as category_name
        FROM projects p
        LEFT JOIN project_categories pc ON p.category_id = pc.id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
      `, [req.user.id]);
    }

    if (type === 'all') {
      data.categories = await promiseQuery(`
        SELECT * FROM transaction_categories 
        WHERE user_id = ? OR user_id IS NULL
      `, [req.user.id]);

      data.payment_methods = await promiseQuery(`
        SELECT * FROM payment_methods 
        WHERE user_id = ? OR user_id IS NULL
      `, [req.user.id]);
    }

    // Set appropriate headers for download
    const filename = `appsking_export_${new Date().toISOString().slice(0, 10)}`;
    
    if (format === 'csv') {
      // Simple CSV export (would need more sophisticated CSV generation for complex data)
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      
      // For simplicity, just export transactions as CSV
      if (data.transactions && data.transactions.length > 0) {
        const headers = Object.keys(data.transactions[0]).join(',');
        const rows = data.transactions.map(row => 
          Object.values(row).map(val => 
            typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
          ).join(',')
        );
        res.send([headers, ...rows].join('\n'));
      } else {
        res.send('No data to export');
      }
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json({
        exported_at: new Date().toISOString(),
        export_type: type,
        period: { start_date, end_date },
        data
      });
    }

  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;