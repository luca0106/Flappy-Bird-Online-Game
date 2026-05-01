// Importarea modulelor necesare
const express = require('express');
const mysql = require('mysql2/promise'); // Folosim varianta cu Promises pentru async/await
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config(); // Încarcă variabilele de mediu din fișierul .env

// Inițializarea aplicației Express
const app = express();

// Middleware-uri
app.use(cors()); // Permite cereri Cross-Origin (de la frontend la backend)
app.use(express.json()); // Permite serverului să înțeleagă JSON-ul trimis în corpul cererilor

// Configurația pentru conexiunea la baza de date
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Crearea unui pool de conexiuni la baza de date
const pool = mysql.createPool(dbConfig);

// --- Middleware pentru Autentificare ---
// Verifică dacă un token JWT este valid
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {
        return res.sendStatus(401); // Unauthorized
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            // Tokenul este invalid sau a expirat
            return res.sendStatus(401); // Unauthorized
        }
        req.user = user;
        next();
    });
};


// --- ENDPOINTS API (Rute) ---

// Endpoint pentru înregistrarea unui utilizator nou
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, username } = req.body;

        if (!email || !password || !username) {
            return res.status(400).json({ message: 'Username, email and password are required.' });
        }

        // Criptarea parolei
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Inserarea în baza de date
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, passwordHash]
        );

        res.status(201).json({ message: 'User registered successfully!', userId: result.insertId });
    } catch (error) {
        // Verifică dacă eroarea este din cauza unui email duplicat
        if (error.code === 'ER_DUP_ENTRY') {
            if (error.message.includes('username')) {
                return res.status(409).json({ message: 'Username already exists.' });
            }
            return res.status(409).json({ message: 'Email already exists.' });
        }
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// Endpoint pentru login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        const user = rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Crearea token-ului JWT
        const payload = { id: user.id, email: user.email };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' }); // Token valabil 1 zi

        res.json({ token });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// Endpoint pentru a obține datele utilizatorului logat (protejat)
app.get('/api/user/me', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, email, best_score FROM users WHERE id = ?', [req.user.id]);
        if (!rows[0]) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// Endpoint pentru a trimite un scor nou (protejat)
app.post('/api/scores', authenticateToken, async (req, res) => {
    try {
        const { score } = req.body;
        const userId = req.user.id;

        // Obține scorul curent
        const [rows] = await pool.query('SELECT best_score FROM users WHERE id = ?', [userId]);
        const currentBest = rows[0].best_score;

        if (score > currentBest) {
            // Actualizează scorul dacă este mai mare
            await pool.query('UPDATE users SET best_score = ? WHERE id = ?', [score, userId]);
            res.json({ message: 'New best score saved!', newBestScore: score });
        } else {
            res.json({ message: 'Score not higher than best.', newBestScore: currentBest });
        }
    } catch (error) {
        console.error('Score submission error:', error);
        res.status(500).json({ message: 'Server error while submitting score.' });
    }
});

// Endpoint pentru a obține clasamentul global (leaderboard)
app.get('/api/leaderboard', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT username, best_score FROM users ORDER BY best_score DESC LIMIT 10'
        );
        res.json(rows);
    } catch (error) {
        console.error('Leaderboard fetch error:', error);
        res.status(500).json({ message: 'Server error while fetching leaderboard.' });
    }
});


// --- Pornirea Serverului ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    try {
        // Testează conexiunea la baza de date la pornire
        const connection = await pool.getConnection();
        console.log('Successfully connected to the database.');
        connection.release(); // Eliberează conexiunea
        console.log(`Backend server is running on http://localhost:${PORT}`);
    } catch (error) {
        console.error('Failed to connect to the database:', error);
        process.exit(1); // Oprește aplicația dacă nu se poate conecta la DB
    }
});
