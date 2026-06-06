const videoSources = [
    'xai-video-81b2c3b4-f28a-48aa-9388-f0b553a80490.mp4',
    'xai-video-99b45a20-0d50-4a6d-ad8c-a8a3531c2487.mp4'
];
let currentVideoIndex = 0;

// Firebase Configuration and Initialization (using provided config)
const firebaseConfig = {
  apiKey: "AIzaSyB7K7LZCNdryJyKhavJZ7RYpLMc_qLJo6w",
  authDomain: "nash-enterprise.firebaseapp.com",
  projectId: "nash-enterprise",
  storageBucket: "nash-enterprise.firebasestorage.app",
  messagingSenderId: "987917763852",
  appId: "1:987917763852:web:f13de1d0c2273ef7a6f529",
  measurementId: "G-NLS1FY27NJ"
};

let db, auth, currentUser = null;

function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded');
    return;
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  db = firebase.firestore();
  auth = firebase.auth();
  auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user && document.getElementById('client-auth-status')) {
      document.getElementById('client-auth-status').textContent = `Signed in as ${user.email}`;
    }
  });
}

function cycleBackgroundVideo() {
    const video = document.getElementById('bgVideo');
    if (!video) return;

    currentVideoIndex = (currentVideoIndex + 1) % videoSources.length;
    video.src = videoSources[currentVideoIndex];
    video.play().catch(() => {});
}

window.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('bgVideo');
    if (video) {
        setInterval(cycleBackgroundVideo, 18000);
        video.style.willChange = 'transform';
        observeScrollMotion(video);
    }

    observeRevealAnimations();
    initFirebase();

    const isAdminPage = document.querySelector('.admin-shell') || document.getElementById('dashboard');
    if (isAdminPage) {
        // Login screen will handle init for admin
        // initAdminPortal() called after successful login
    } else {
        // Setup client auth UI for main site
        setupClientAuthUI();
    }
});

function observeScrollMotion(video) {
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                const offset = window.scrollY * 0.16;
                video.style.transform = `translate3d(0, ${offset}px, 0) scale(1.08)`;
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
}

function observeRevealAnimations() {
    const items = document.querySelectorAll('.hero-content, .service-card, .feature-card, .glass-panel, .metric-card, .list-item, .section-header');
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                obs.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.12
    });

    items.forEach(item => observer.observe(item));
}

function selectService(serviceName) {
    showToast(`Selected: ${serviceName}. Complete the intake form (login required for submission).`);
}

function submitIntakeForm() {
    const name = document.getElementById('client-name').value.trim();
    const email = document.getElementById('client-email').value.trim();
    const phone = document.getElementById('client-phone').value.trim();
    const address = document.getElementById('client-address').value.trim();
    const service = document.getElementById('client-service').value;
    const details = document.getElementById('client-details').value.trim();
    const serviceDatetime = document.getElementById('service-datetime').value;

    if (!name || !email || !phone || !address) {
        showToast('Please complete all required fields before submitting.');
        return;
    }

    if (!currentUser) {
        showToast('Please login or create an account to submit intake.');
        toggleAuthModal();
        return;
    }

    // Save to Firestore for real-time sync to admin (includes new date/time and paid status)
    db.collection('submissions').add({
        id: Date.now(),
        name,
        email,
        phone,
        address,
        service,
        details,
        serviceDatetime: serviceDatetime || new Date().toISOString(),
        paid: false, // Default unpaid; admin can toggle
        status: 'New',
        submittedAt: new Date().toLocaleString(),
        uid: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        resetIntakeFields();
        showToast('Intake request received! It will appear in the admin portal in real-time.');
    }).catch(err => {
        console.error(err);
        showToast('Error submitting intake. Please try again.');
    });
}

function resetIntakeFields() {
    document.getElementById('client-name').value = '';
    document.getElementById('client-email').value = '';
    document.getElementById('client-phone').value = '';
    document.getElementById('client-address').value = '';
    document.getElementById('client-details').value = '';
    const datetimeInput = document.getElementById('service-datetime');
    if (datetimeInput) datetimeInput.value = '';
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3200);
}

// Firebase helper functions (replaces localStorage for real-time data)
let submissionsListener = null;

function seedMockData() {
    // Seed mock submissions if collection is empty (for demo, with new fields)
    db.collection('submissions').get().then(snapshot => {
    if (snapshot.empty) {
        const mockData = [
            {
                id: 2026001,
                name: 'Monica Hale',
                email: 'monica@nashservices.com',
                phone: '(555) 892-2431',
                address: '496 Ridgeway Ave, City',
                service: 'Eviction Cleanup',
                details: 'Need same-day removal after eviction notice.',
                serviceDatetime: '2026-06-10T14:00',
                paid: true,
                status: 'New',
                submittedAt: '2026-06-05 10:42 AM',
                timestamp: firebase.firestore.Timestamp.now()
            },
            {
                id: 2026002,
                name: 'Derrick Fields',
                email: 'derrick@estatepro.com',
                phone: '(555) 217-8842',
                address: '720 Elm St, Suite B',
                service: 'Bulk Debris Haulaway',
                details: 'Old furniture and drywall from remodel.',
                serviceDatetime: '2026-06-15T09:30',
                paid: false,
                status: 'In Progress',
                submittedAt: '2026-06-04 2:18 PM',
                timestamp: firebase.firestore.Timestamp.now()
            }
        ];
        mockData.forEach(data => {
            db.collection('submissions').add(data);
        });
        console.log('Mock data seeded to Firebase (with paid status & service datetime)');
    }
    }).catch(console.error);
}

function initAdminPortal() {
    if (!document.getElementById('service-list')) return;
    
    // Services remain in local for demo (can be extended to Firestore)
    const defaultServices = [
        { id: 1, name: 'Eviction Cleanup', rate: '$524', notes: 'Vacated property cleanout with debris hauling.', status: 'Active' },
        { id: 2, name: 'Trash Removal', rate: '$156', notes: 'Residential and commercial trash pickup.', status: 'Active' },
        { id: 3, name: 'Bulk Debris Haulaway', rate: '$261', notes: 'Large haulaway for furniture and waste.', status: 'Ready' }
    ];
    // Render services from default (mock)
    renderServices(defaultServices);

    // Real-time listener for submissions from Firebase (live updates from client intake, with filter support)
    if (submissionsListener) submissionsListener();
    submissionsListener = db.collection('submissions')
        .orderBy('timestamp', 'desc')
        .onSnapshot(snapshot => {
            const submissions = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                submissions.push({
                    ...data,
                    id: data.id || doc.id,
                    docId: doc.id
                });
            });
            renderSubmissions(submissions, currentSubmissionFilter);
            updateMetrics(submissions);
            seedMockData(); // Ensure mock if empty
        }, error => {
            console.error('Firestore listener error:', error);
            showToast('Live updates unavailable - using mock data');
        });
}

function renderServices(services) {
    const serviceList = document.getElementById('service-list');
    if (serviceList) {
        serviceList.innerHTML = services.map(service => `
            <div class="list-item">
                <h4>${service.name}</h4>
                <span>${service.notes}</span>
                <p><strong>${service.rate}</strong></p>
                <div class="status-pill ${service.status.toLowerCase() === 'ready' ? 'done' : 'active'}">${service.status}</div>
            </div>
        `).join('');
    }
}

function renderSubmissions(submissions, filter = 'all') {
    const submissionList = document.getElementById('submission-list');
    if (!submissionList) return;

    let filtered = submissions;
    if (filter === 'paid') {
        filtered = submissions.filter(item => item.paid === true);
    } else if (filter === 'unpaid') {
        filtered = submissions.filter(item => item.paid === false);
    }

    submissionList.innerHTML = filtered.map(item => {
        const dateStr = item.serviceDatetime ? new Date(item.serviceDatetime).toLocaleString() : 'TBD';
        const paidStatus = item.paid ? 'paid' : 'unpaid';
        return `
            <div class="list-item">
                <h4>${item.name} — ${item.service}</h4>
                <span>${item.email} · ${item.phone}</span>
                <p>${item.address} | Service: ${dateStr}</p>
                <p>${item.details || 'No additional notes provided.'}</p>
                <div style="margin-top:0.8rem; display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center;">
                    <span class="status-pill ${item.status === 'New' ? 'active' : 'done'}">${item.status}</span>
                    <span class="paid-pill ${paidStatus}">${item.paid ? 'Paid' : 'Unpaid'}</span>
                    <button class="button button-secondary" onclick="togglePaidStatus('${item.id || item.docId || ''}')">Toggle Paid</button>
                    <button class="button button-secondary" onclick="completeSubmission('${item.id || item.docId || ''}')">Mark Complete</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateMetrics(submissions = []) {
    const serviceCount = document.getElementById('service-count');
    const submissionCount = document.getElementById('submission-count');
    const dispatchCount = document.getElementById('dispatch-count');
    const clientCount = document.getElementById('client-count');
    const servicesLength = 3; // from default mock
    const uniqueClients = new Set(submissions.map(s => s.email)).size || 24; // dynamic from data or mock

    if (serviceCount) serviceCount.textContent = servicesLength;
    if (submissionCount) submissionCount.textContent = submissions.filter(item => item.status === 'New').length;
    if (dispatchCount) dispatchCount.textContent = submissions.filter(item => item.status !== 'New').length;
    if (clientCount) clientCount.textContent = uniqueClients;
}

let currentSubmissionFilter = 'all';

function filterSubmissions(filter) {
    currentSubmissionFilter = filter;
    const buttons = document.querySelectorAll('#submission-filters .filter-btn');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === filter || 
            (filter === 'all' && btn.textContent === 'All'));
    });
    // Re-render with current data (listener will trigger full refresh, or call render with cached)
    // For simplicity, trigger full re-init or use global cache if needed
    initAdminPortal(); // Refresh listener for demo
}

function togglePaidStatus(id) {
    if (!id || !db) return;
    db.collection('submissions').where('id', '==', parseInt(id) || id).get().then(snapshot => {
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const currentPaid = doc.data().paid || false;
            doc.ref.update({ paid: !currentPaid }).then(() => {
                showToast(`Marked as ${!currentPaid ? 'Paid' : 'Unpaid'}. Live update applied.`);
            });
        }
    }).catch(err => {
        console.error(err);
        showToast('Toggle failed.');
    });
}

function saveServicePackage() {
    const name = document.getElementById('new-service-name').value.trim();
    const rate = document.getElementById('new-service-rate').value.trim();
    const notes = document.getElementById('new-service-notes').value.trim();

    if (!name || !rate) {
        showToast('Please provide both name and rate for the service package.');
        return;
    }

    // Services kept in local for this demo (Firestore extension possible)
    let services = JSON.parse(localStorage.getItem('nash_services') || '[]');
    services.unshift({
        id: Date.now(),
        name,
        rate,
        notes: notes || 'Custom service package',
        status: 'Active'
    });
    localStorage.setItem('nash_services', JSON.stringify(services));
    document.getElementById('new-service-name').value = '';
    document.getElementById('new-service-rate').value = '';
    document.getElementById('new-service-notes').value = '';
    initAdminPortal(); // Refresh
    showToast('Service package added successfully.');
}

function completeSubmission(id) {
    if (!id) return;
    db.collection('submissions').where('id', '==', parseInt(id) || id).get().then(snapshot => {
        if (!snapshot.empty) {
            snapshot.docs[0].ref.update({ status: 'Completed' }).then(() => {
                showToast('Submission status updated in real-time.');
            });
        }
    }).catch(err => {
        console.error(err);
        showToast('Update failed.');
    });
}

function addMockService() {
    const newService = {
        id: Date.now(),
        name: 'Tenant Turnover Cleanup',
        rate: '$389',
        notes: 'Detail cleanup for move-out units and preparation for relisting.',
        status: 'Ready'
    };
    let services = JSON.parse(localStorage.getItem('nash_services') || '[]');
    services.unshift(newService);
    localStorage.setItem('nash_services', JSON.stringify(services));
    initAdminPortal();
    showToast('Mock service added to the portal.');
}

function clearAllData() {
    if (confirm('Reset all demo data? This will clear Firestore submissions too.')) {
        localStorage.removeItem('nash_services');
        // Clear Firestore submissions
        db.collection('submissions').get().then(snapshot => {
            snapshot.forEach(doc => doc.ref.delete());
        });
        initAdminPortal();
        showToast('Demo data has been reset (live sync).');
    }
}

function attemptLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    
    if (username === 'admin999' && password === 'nash1998') {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        document.getElementById('logout-btn').style.display = 'inline-flex';
        errorEl.textContent = '';
        currentSubmissionFilter = 'all';
        initAdminPortal();
        showToast('Successfully logged in as Administrator. Revamped HUD with paid/unpaid filters and glass effects active.');
    } else {
        errorEl.textContent = 'Invalid username or password. Please try again.';
        document.getElementById('password').value = '';
        // Shake effect for demo
        const container = document.querySelector('.login-container');
        container.style.animation = 'shake 0.4s';
        setTimeout(() => { container.style.animation = ''; }, 500);
    }
}

function logout() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('login-error').textContent = '';
    showToast('Logged out successfully.');
}

// Add shake animation if not present
if (!document.getElementById('shake-style')) {
    const style = document.createElement('style');
    style.id = 'shake-style';
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-8px); }
            40%, 80% { transform: translateX(8px); }
        }
    `;
    document.head.appendChild(style);
}

// AI Chat Widget Functions (integrates with secure xAI backend at /api/ai-recommend)
function toggleAIChat() {
    const chat = document.getElementById('ai-chat');
    chat.style.display = chat.style.display === 'flex' ? 'none' : 'flex';
    if (chat.style.display === 'flex') {
        document.getElementById('ai-input').focus();
    }
}

async function sendAIQuery() {
    const input = document.getElementById('ai-input');
    const prompt = input.value.trim();
    if (!prompt) return;

    const bodyEl = document.getElementById('ai-chat-body');
    // Add user message
    bodyEl.innerHTML += `<div class="ai-message user">${prompt}</div>`;
    bodyEl.scrollTop = bodyEl.scrollHeight;
    input.value = '';

    // Show typing indicator
    const typingId = 'typing-' + Date.now();
    bodyEl.innerHTML += `<div id="${typingId}" class="ai-message bot">Thinking with Grok...</div>`;
    bodyEl.scrollTop = bodyEl.scrollHeight;

    try {
        const response = await fetch('/api/ai-recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: prompt,
                context: currentUser ? `User: ${currentUser.email}. Firebase synced intake data.` : 'Demo user. Use mock data for recommendations on trash removal, eviction, property services with updated pricing.'
            })
        });
        const data = await response.json();
        
        // Remove typing
        const typing = document.getElementById(typingId);
        if (typing) typing.remove();
        
        const botMsg = data.recommendation || data.error || 'Sorry, I could not generate a recommendation at this time.';
        bodyEl.innerHTML += `<div class="ai-message bot">${botMsg.replace(/\n/g, '<br>')}</div>`;
    } catch (err) {
        console.error(err);
        const typing = document.getElementById(typingId);
        if (typing) typing.innerHTML = 'AI backend unavailable (check server). Using mock: Our Eviction Cleanup package at $524 is recommended for your needs.';
    }
    bodyEl.scrollTop = bodyEl.scrollHeight;
}

function setupClientAuthUI() {
    // Placeholder for additional client UI setup (Firebase auth ready)
    console.log('Client auth UI initialized with Firebase + xAI backend.');
    // Can be extended with auth state UI in navbar if needed
}

// Client Auth Modal Functions (Firebase Auth integration)
let currentAuthTab = 0;

function switchAuthTab(tab) {
    currentAuthTab = tab;
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const tabs = document.querySelectorAll('.auth-tab');
    
    tabs.forEach((t, i) => t.classList.toggle('active', i === tab));
    loginForm.style.display = tab === 0 ? 'block' : 'none';
    signupForm.style.display = tab === 1 ? 'block' : 'none';
}

function toggleAuthModal() {
    const modal = document.getElementById('auth-modal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
    if (modal.style.display === 'flex') {
        switchAuthTab(0);
        document.getElementById('auth-message').textContent = '';
    }
}

async function clientLogin() {
    const email = document.getElementById('client-email-login').value.trim();
    const password = document.getElementById('client-password-login').value;
    const messageEl = document.getElementById('auth-message');
    
    if (!email || !password) {
        messageEl.textContent = 'Please enter email and password.';
        return;
    }
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        messageEl.style.color = 'var(--gold)';
        messageEl.textContent = 'Login successful! You can now submit intake forms.';
        setTimeout(() => {
            toggleAuthModal();
        }, 1500);
    } catch (error) {
        messageEl.textContent = error.message || 'Login failed. Try creating an account.';
    }
}

async function clientSignup() {
    const name = document.getElementById('client-name-signup').value.trim();
    const email = document.getElementById('client-email-signup').value.trim();
    const password = document.getElementById('client-password-signup').value;
    const messageEl = document.getElementById('auth-message');
    
    if (!email || !password || password.length < 6) {
        messageEl.textContent = 'Please provide valid email and password (6+ chars).';
        return;
    }
    
    try {
        const userCred = await auth.createUserWithEmailAndPassword(email, password);
        // Optional: update profile with name
        await userCred.user.updateProfile({ displayName: name });
        messageEl.style.color = 'var(--gold)';
        messageEl.textContent = 'Account created successfully! Welcome to Nash Services.';
        setTimeout(() => {
            toggleAuthModal();
        }, 1500);
    } catch (error) {
        messageEl.textContent = error.message || 'Signup failed. Please try again.';
    }
}
