CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    best_score INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Acest tabel este suficient pentru a începe.
-- `password_hash` va stoca parola criptată, nu parola reală.
-- `best_score` se va actualiza de fiecare dată când utilizatorul obține un scor mai bun.