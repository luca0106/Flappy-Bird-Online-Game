-- Acest script va fi executat automat de Docker la prima pornire a bazei de date.
-- El creează tabela 'users' cu structura corectă, incluzând coloana 'username'.

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    best_score INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabelă pentru stocarea temporară a codurilor de verificare
CREATE TABLE IF NOT EXISTS email_verification (
    email VARCHAR(255) NOT NULL PRIMARY KEY,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL
);