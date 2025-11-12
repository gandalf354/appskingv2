const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get dashboard overview
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const { period = 'all' } = req.query; // all, month, week, year
    
    let dateFilter = '';
    switch (period) {
      case 'week':
        dateFilter = 'AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
        break;
      case 'month':
        dateFilter = 'AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
        break;
      case 'year':
        dateFilter = 'AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)';
        break;
      case 'all':
      default:
        dateFilter = ''; // No date filter, show all data
        break;
    }

    // Financial summary - show all transactions by default
    const financialSummary = await executeQuery(`
      SELECT 
        type,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count
      FROM transactions 
      WHERE 1=1 ${dateFilter}
      GROUP BY type
    `, []);

    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    financialSummary.forEach(row => {
      if (row.type === 'income') {
        totalIncome = parseFloat(row.total_amount);
        incomeCount = row.transaction_count;
      } else if (row.type === 'expense') {
        totalExpense = parseFloat(row.total_amount);
        expenseCount = row.transaction_count;
      }
    });

    const netAmount = totalIncome - totalExpense;

    // Project summary
    const projectSummary = await executeQuery(`
      SELECT 
        status,
        COUNT(*) as project_count,
        SUM(budget) as total_budget
      FROM projects 
      WHERE 1=1
      GROUP BY status
    `, []);

    // Recent transactions - sorted by transaction_date DESC, then created_at DESC
    const recentTransactions = await executeQuery(`
      SELECT t.*, 
             tc.name as category_name, tc.color as category_color,
             pm.name as payment_method_name,
             p.name as project_name
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE 1=1
      ORDER BY t.transaction_date DESC, t.created_at DESC
      LIMIT 10
    `, []);

    // Active projects
    const activeProjects = await executeQuery(`
      SELECT p.*, pc.name as category_name, pc.color as category_color,
             COUNT(pm.id) as milestone_count,
             SUM(CASE WHEN pm.status = 'completed' THEN 1 ELSE 0 END) as completed_milestones
      FROM projects p
      LEFT JOIN project_categories pc ON p.category_id = pc.id
      LEFT JOIN project_milestones pm ON p.id = pm.project_id
      WHERE 1=1 AND p.status = 'active'
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 5
    `, []);

    // Expense by category (top 5) - use same period filter
    const expenseByCategory = await executeQuery(`
      SELECT tc.name, tc.color, SUM(t.amount) as total_amount
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      WHERE 1=1 AND t.type = 'expense' ${dateFilter}
      GROUP BY t.category_id, tc.name, tc.color
      ORDER BY total_amount DESC
      LIMIT 5
    `, []);

    // Monthly trend (last 6 months)
    const monthlyTrend = await executeQuery(`
      SELECT 
        DATE_FORMAT(transaction_date, '%Y-%m') as month,
        type,
        SUM(amount) as total_amount
      FROM transactions 
      WHERE 1=1 AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY month, type
      ORDER BY month ASC
    `, []);

    res.json({
      period,
      financial_summary: {
        total_income: totalIncome,
        total_expense: totalExpense,
        net_amount: netAmount,
        income_count: incomeCount,
        expense_count: expenseCount
      },
      project_summary: projectSummary,
      recent_transactions: recentTransactions,
      active_projects: activeProjects,
      expense_by_category: expenseByCategory,
      monthly_trend: monthlyTrend
    });

  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
});

// Get cashflow data
router.get('/cashflow', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, granularity = 'daily' } = req.query;
    
    let dateFormat = '%Y-%m-%d';
    let intervalDays = 30;

    switch (granularity) {
      case 'daily':
        dateFormat = '%Y-%m-%d';
        intervalDays = 30;
        break;
      case 'weekly':
        dateFormat = '%Y-%u';
        intervalDays = 84; // 12 weeks
        break;
      case 'monthly':
        dateFormat = '%Y-%m';
        intervalDays = 365; // 12 months
        break;
    }

    let query = `
      SELECT 
        DATE_FORMAT(transaction_date, '${dateFormat}') as period,
        type,
        SUM(amount) as total_amount
      FROM transactions 
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ' AND transaction_date >= ?';
      params.push(start_date);
    } else {
      query += ` AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL ${intervalDays} DAY)`;
    }

    if (end_date) {
      query += ' AND transaction_date <= ?';
      params.push(end_date);
    }

    query += ' GROUP BY period, type ORDER BY period ASC';

    const cashflowData = await executeQuery(query, params);

    // Process data for better frontend consumption
    const processedData = {};
    cashflowData.forEach(row => {
      if (!processedData[row.period]) {
        processedData[row.period] = { period: row.period, income: 0, expense: 0 };
      }
      processedData[row.period][row.type] = parseFloat(row.total_amount);
    });

    const cashflow = Object.values(processedData).map(period => ({
      ...period,
      net: period.income - period.expense
    }));

    res.json({ cashflow, granularity });

  } catch (error) {
    console.error('Get cashflow data error:', error);
    res.status(500).json({ error: 'Failed to fetch cashflow data' });
  }
});

// Get budget vs actual spending
router.get('/budget-analysis', authenticateToken, async (req, res) => {
  try {
    const { month = new Date().toISOString().slice(0, 7) } = req.query; // YYYY-MM

    // Get budget plans for the month
    const budgetPlans = await executeQuery(`
      SELECT bp.*, tc.name as category_name, tc.color as category_color
      FROM budget_plans bp
      LEFT JOIN transaction_categories tc ON bp.category_id = tc.id
      WHERE bp.user_id = ? AND bp.month = ?
    `, [req.user.id, month]);

    // Get actual spending for each category
    const actualSpending = await executeQuery(`
      SELECT 
        category_id,
        SUM(amount) as actual_amount
      FROM transactions
      WHERE 1=1 AND type = 'expense' 
        AND DATE_FORMAT(transaction_date, '%Y-%m') = ?
      GROUP BY category_id
    `, [month]);

    // Combine budget and actual data
    const budgetAnalysis = budgetPlans.map(budget => {
      const actual = actualSpending.find(a => a.category_id === budget.category_id);
      const actualAmount = actual ? parseFloat(actual.actual_amount) : 0;
      const budgetAmount = parseFloat(budget.budget_amount);
      const variance = budgetAmount - actualAmount;
      const percentUsed = budgetAmount > 0 ? (actualAmount / budgetAmount) * 100 : 0;

      return {
        ...budget,
        actual_amount: actualAmount,
        variance: variance,
        percent_used: percentUsed,
        status: variance >= 0 ? 'under_budget' : 'over_budget'
      };
    });

    res.json({ 
      month, 
      budget_analysis: budgetAnalysis 
    });

  } catch (error) {
    console.error('Get budget analysis error:', error);
    res.status(500).json({ error: 'Failed to fetch budget analysis' });
  }
});

// Get project profitability
router.get('/project-profitability', authenticateToken, async (req, res) => {
  try {
    const projects = await executeQuery(`
      SELECT 
        p.id,
        p.name,
        p.budget,
        p.status,
        SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) as total_income,
        SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) as total_expense
      FROM projects p
      LEFT JOIN transactions t ON p.id = t.project_id
      WHERE 1=1
      GROUP BY p.id, p.name, p.budget, p.status
      ORDER BY p.created_at DESC
    `, []);

    const profitability = projects.map(project => {
      const totalIncome = parseFloat(project.total_income) || 0;
      const totalExpense = parseFloat(project.total_expense) || 0;
      const budget = parseFloat(project.budget) || 0;
      const profit = totalIncome - totalExpense;
      const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;
      const budgetUsed = budget > 0 ? (totalExpense / budget) * 100 : 0;

      return {
        id: project.id,
        name: project.name,
        status: project.status,
        budget: budget,
        total_income: totalIncome,
        total_expense: totalExpense,
        profit: profit,
        margin: margin,
        budget_used_percent: budgetUsed,
        budget_remaining: budget - totalExpense
      };
    });

    res.json({ project_profitability: profitability });

  } catch (error) {
    console.error('Get project profitability error:', error);
    res.status(500).json({ error: 'Failed to fetch project profitability' });
  }
});

module.exports = router;