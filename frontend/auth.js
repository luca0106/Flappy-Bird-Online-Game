document.addEventListener('DOMContentLoaded', () => {
    const API_URL = CONFIG.API_URL;

    const showLoginBtn = document.getElementById('showLoginBtn');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    const registerStep1 = document.getElementById('registerStep1');
    const registerStep2 = document.getElementById('registerStep2');
    const sentToEmailDisplay = document.getElementById('sentToEmail');

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function resetRegisterFlow() {
        registerForm.reset();
        registerStep1.style.display = 'block';
        registerStep2.style.display = 'none';
        sendCodeBtn.disabled = false;
        sendCodeBtn.textContent = 'Send Verification Code';
        sentToEmailDisplay.textContent = '';
    }

    // --- Form Toggle Logic ---
    showLoginBtn.addEventListener('click', () => {
        loginForm.style.display = 'flex';
        registerForm.style.display = 'none';
        resetRegisterFlow();
        showLoginBtn.classList.add('active');
        showRegisterBtn.classList.remove('active');
    });

    showRegisterBtn.addEventListener('click', () => {
        loginForm.style.display = 'none';
        registerForm.style.display = 'flex';
        resetRegisterFlow();
        showLoginBtn.classList.remove('active');
        showRegisterBtn.classList.add('active');
    });

    // --- Password Visibility ---
    document.querySelectorAll('.password-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const inputId = button.dataset.for;
            const passwordInput = document.getElementById(inputId);
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                button.textContent = '🙈';
            } else {
                passwordInput.type = 'password';
                button.textContent = '👁️';
            }
        });
    });

    // --- Form Submission Logic ---
    async function handleLogin(event) {
        event.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Login failed');

            // Save token and redirect to main game page
            localStorage.setItem('flappyBirdAuthToken', data.token);
            window.location.href = 'index.html';

        } catch (error) {
            alert(`Login Error: ${error.message}`);
        }
    }

    async function requestVerificationCode() {
        const email = document.getElementById('registerEmail').value;
        if (!email || !EMAIL_REGEX.test(email)) {
            alert('Please enter a valid email address.');
            return;
        }

        sendCodeBtn.disabled = true;
        sendCodeBtn.textContent = 'Sending...';

        try {
            const response = await fetch(`${API_URL}/auth/request-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);

            alert('A verification code has been sent to your email.');
            sentToEmailDisplay.textContent = email;
            registerStep1.style.display = 'none';
            registerStep2.style.display = 'block';

        } catch (error) {
            alert(`Error: ${error.message}`);
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = 'Send Verification Code';
        }
    }

    async function completeRegistration(event) {
        event.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const verificationCode = document.getElementById('verificationCode').value;
        const username = document.getElementById('registerUsername').value;
        const password = document.getElementById('registerPassword').value;
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, verificationCode, username, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Registration failed');
            
            alert('Registration successful! Please log in.');
            showLoginBtn.click(); // Switch to login view and reset the register flow

        } catch (error) {
            alert(`Registration Error: ${error.message}`);
        }
    }

    loginForm.addEventListener('submit', handleLogin);
    sendCodeBtn.addEventListener('click', requestVerificationCode);
    registerForm.addEventListener('submit', completeRegistration);
});

