const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const app = express();
app.use(express.json());

let db;

// 1. Database setup & Initialisation

async function initDB() {
    // Open a database connection
    db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    // Create Users table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('Viewer', 'Analyst', 'Admin')),
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive'))
        )
    `);

    // Create Financial Records table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            notes TEXT
        )
    `);

    // Seed an initial Admin user if the table is empty
    const adminExists = await db.get('SELECT * FROM users WHERE role = "Admin"');
    if (!adminExists) {
        await db.run('INSERT INTO users (username, role) VALUES (?, ?)', ['superadmin', 'Admin']);
        console.log('Seeded initial Admin user with ID: 1');
    }
}

// Auth & Access Control

// Mock Authentication
async function authenticate(req, res, next) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required. Missing x-user-id header.' });
    }

    try {
        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user || user.status === 'inactive') {
            return res.status(401).json({ error: 'Invalid or inactive user.' });
        }
        req.user = user; 
        next();
    } catch (error) {
        res.status(500).json({ error: 'Internal server error during authentication.' });
    }
}

// Role-based Authorization 
function authorize(allowedRoles) {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: `Forbidden: Requires one of roles: ${allowedRoles.join(', ')}` });
        }
        next();
    };
}

// Routes: User Management

// Create a new user
app.post('/api/users', authenticate, authorize(['Admin']), async (req, res) => {
    const { username, role, status = 'active' } = req.body;
    
    // Input Validation
    if (!username || !role) {
        return res.status(400).json({ error: 'Username and role are required.' });
    }

    try {
        const result = await db.run(
            'INSERT INTO users (username, role, status) VALUES (?, ?, ?)',
            [username, role, status]
        );
        res.status(201).json({ message: 'User created', userId: result.lastID });
    } catch (error) {
        res.status(400).json({ error: 'Could not create user. Username might already exist or role is invalid.' });
    }
});

// Get all users
app.get('/api/users', authenticate, authorize(['Admin']), async (req, res) => {
    const users = await db.all('SELECT * FROM users');
    res.json(users);
});

// Routes: Financial Records

// Create a record - admin
app.post('/api/records', authenticate, authorize(['Admin']), async (req, res) => {
    const { amount, type, category, date, notes } = req.body;

    // Validation
    if (!amount || !type || !category || !date) {
        return res.status(400).json({ error: 'Amount, type, category, and date are required.' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number.' });
    }

    try {
        const result = await db.run(
            'INSERT INTO records (amount, type, category, date, notes) VALUES (?, ?, ?, ?, ?)',
            [amount, type, category, date, notes || '']
        );
        res.status(201).json({ message: 'Record created', recordId: result.lastID });
    } catch (error) {
        res.status(500).json({ error: 'Database error while creating record.' });
    }
});

// Get records 
app.get('/api/records', authenticate, authorize(['Viewer', 'Analyst', 'Admin']), async (req, res) => {
    const { type, category } = req.query;
    let query = 'SELECT * FROM records WHERE 1=1';
    let params = [];

    if (type) {
        query += ' AND type = ?';
        params.push(type);
    }
    if (category) {
        query += ' AND category = ?';
        params.push(category);
    }

    query += ' ORDER BY date DESC';

    try {
        const records = await db.all(query, params);
        res.json(records);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch records.' });
    }
});

// Routes: Dashboard Analytics

// Get summary data 
app.get('/api/summary', authenticate, authorize(['Analyst', 'Admin']), async (req, res) => {
    try {
        // Run aggregation queries concurrently
        const [totals, categoryTotals, recentActivity] = await Promise.all([
            db.all('SELECT type, SUM(amount) as totalAmount FROM records GROUP BY type'),
            db.all('SELECT category, type, SUM(amount) as totalAmount FROM records GROUP BY category, type'),
            db.all('SELECT * FROM records ORDER BY date DESC LIMIT 5')
        ]);

        // Process totals into a clean format
        let totalIncome = 0;
        let totalExpenses = 0;

        totals.forEach(row => {
            if (row.type === 'income') totalIncome = row.totalAmount;
            if (row.type === 'expense') totalExpenses = row.totalAmount;
        });

        res.json({
            overview: {
                totalIncome,
                totalExpenses,
                netBalance: totalIncome - totalExpenses
            },
            categoryBreakdown: categoryTotals,
            recentActivity
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate summary analytics.' });
    }
});

// Start server
initDB().then(() => {
    app.listen(3000, () => {
        console.log('Server running on http://localhost:3000');
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
});