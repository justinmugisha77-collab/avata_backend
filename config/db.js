const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Database file location
const dbPath = path.join(__dirname, '../database.sqlite');

// Create/open SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');
    }
});

// Store original methods
const originalRun = db.run;
const originalGet = db.get;
const originalAll = db.all;

// Wrapper for run that supports both callback and promise
db.run = function(sql, params = [], callback) {
    // If callback is provided, use original behavior
    if (typeof callback === 'function') {
        return originalRun.call(this, sql, params, callback);
    }
    
    // If no callback, return a promise
    return new Promise((resolve, reject) => {
        originalRun.call(this, sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

// Promisify get
db.get = function(sql, params = []) {
    return new Promise((resolve, reject) => {
        originalGet.call(this, sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// Promisify all
db.all = function(sql, params = []) {
    return new Promise((resolve, reject) => {
        originalAll.call(this, sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

module.exports = db;
