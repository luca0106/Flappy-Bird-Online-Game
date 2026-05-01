// Importarea modulelor necesare
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Inițializarea aplicației Express
const app = express();

// Security headers
app.use(helmet());

// Middleware-uri
app.use(cors());
app.use(express.json());

// Rate limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minute
    max: 10, // max 10 cereri per IP per fereastra
    message: { message: 'Too many attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const codeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 ora
    max: 5, // max 5 emailuri per IP pe ora
    message: { message: 'Too many verification code requests. Please try again in an hour.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Configurația pentru conexiunea la baza de date
const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Crearea unui pool de conexiuni la baza de date
const pool = mysql.createPool(dbConfig);

async function ensureDatabaseSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS email_verification (
            email VARCHAR(255) NOT NULL PRIMARY KEY,
            code VARCHAR(6) NOT NULL,
            expires_at TIMESTAMP NOT NULL
        )
    `);
}

// Configurația pentru Nodemailer (trimitere email-uri)
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_PORT == 465,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

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

// Endpoint pentru a cere un cod de verificare pe email
app.post('/api/auth/request-code', codeLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    try {
        // Verifică dacă email-ul este deja înregistrat
        const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length > 0) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }

        const code = crypto.randomInt(100000, 1000000).toString(); // Generează un cod de 6 cifre
        const expires_at = new Date(Date.now() + 10 * 60 * 1000); // Valabil 10 minute

        // Salvează codul în baza de date (sau îl actualizează dacă există deja)
        await pool.query(
            'INSERT INTO email_verification (email, code, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE code = ?, expires_at = ?',
            [email, code, expires_at, code, expires_at]
        );

        // Trimite email-ul
        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: email,
            subject: 'Your Flappy Bird Verification Code',
            text: `Your verification code is: ${code}`,
            html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code will expire in 10 minutes.</p>`,
        });

        res.status(200).json({ message: 'Verification code sent successfully.' });

    } catch (error) {
        console.error('Error sending verification code:', error);
        res.status(500).json({ message: 'Failed to send verification code.' });
    }
});

// Endpoint pentru înregistrarea unui utilizator nou
app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
        const { email, password, username, verificationCode } = req.body;

        if (!email || !password || !username || !verificationCode) {
            return res.status(400).json({ message: 'All fields, including verification code, are required.' });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters.' });
        }

        if (username.length < 3 || username.length > 50) {
            return res.status(400).json({ message: 'Username must be between 3 and 50 characters.' });
        }

        // Verifică codul
        const [rows] = await pool.query('SELECT * FROM email_verification WHERE email = ?', [email]);
        const verificationData = rows[0];

        if (!verificationData || verificationData.code !== verificationCode || new Date() > new Date(verificationData.expires_at)) {
            return res.status(400).json({ message: 'Invalid or expired verification code.' });
        }

        // Dacă codul este valid, continuă cu înregistrarea
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const [result] = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, passwordHash]
        );

        // Șterge codul de verificare după utilizare
        await pool.query('DELETE FROM email_verification WHERE email = ?', [email]);

        res.status(201).json({ message: 'User registered successfully!', userId: result.insertId });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Username or email already exists.' });
        }
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// Endpoint pentru login
app.post('/api/auth/login', authLimiter, async (req, res) => {
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
        const payload = { id: user.id }; // Trimitem doar ID-ul, este suficient pentru a identifica utilizatorul.
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
        const [rows] = await pool.query(
            'SELECT id, username, email, best_score AS bestScore FROM users WHERE id = ?',
            [req.user.id]
        );
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
        await ensureDatabaseSchema();
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
