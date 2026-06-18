// script.js - Modernized for Firebase modular (v10+), Quick Request for signed-in users,
// full 3-video hero loop, no mock data in admin, enhanced sign-in flow for services.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, where, getDocs, doc, updateDoc, getDoc, deleteDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js";

// Your web app's Firebase configuration (provided by user)
const firebaseConfig = {
  apiKey: "AIzaSyB7K7LZCNdryJyKhavJZ7RYpLMc_qLJo6w",
  authDomain: "nash-enterprise.firebaseapp.com",
  projectId: "nash-enterprise",
  storageBucket: "nash-enterprise.firebasestorage.app",
  messagingSenderId: "987917763852",
  appId: "1:987917763852:web:f13de1d0c2273ef7a6f529",
  measurementId: "G-NLS1FY27NJ"
};

// Initialize Firebase (modular)
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let userProfile = null;
let submissionsListener = null;
let reviewsListener = null;
let currentSubmissionFilter = 'all';
let selectedQuickService = null;

const videoSources = [
    'xai-video-81b2c3b4-f28a-48aa-9388-f0b553a80490.mp4',
    'xai-video-99b45a20-0d50-4a6d-ad8c-a8a3531c2487.mp4',
    'grok-video-4522949d-c6e9-4af8-a047-6274d953faee2.mp4'
];
let currentVideoIndex = 0;

// Core offered services for admin display (no mocks, professional reference list)
const coreOfferedServices = [
  { name: 'Property Preservation', notes: 'Inspections, securing, boarding, winterization, general maintenance' },
  { name: 'Cleanouts & Debris Removal', notes: 'Estate, eviction, trash-out, appliance, construction debris' },
  { name: 'Lawn Care & Exterior', notes: 'Grass cutting, shrub trimming, seasonal cleanup, pressure washing, gutters' },
  { name: 'Construction & Repairs', notes: 'Roofing, drywall, painting, flooring, doors/windows, decks/fences, carpentry' },
  { name: 'Residential Rehabilitation', notes: 'Rental turnovers, interior/exterior improvements, full rehab' },
  { name: 'Emergency Services', notes: 'Storm damage, emergency repairs, tree debris, water damage' }
];

function initFirebase() {
  // Modular is already initialized above. Set up global auth listener.
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    userProfile = null;

    if (user) {
      // Load profile if exists
      const profile = await loadUserProfile(user.uid);
      if (profile) {
        userProfile = profile;
      }
    }

    updateUserUI(user);

    // If on admin page after custom admin login, the dashboard init is separate
    const isAdminPage = document.querySelector('.admin-shell') || document.getElementById('dashboard');
    if (isAdminPage && user) {
      // Admin uses its own custom login flow (username/pass), not this Firebase client auth primarily
    }
  });
  console.log('Firebase modular initialized (Nash Enterprise).');
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

    // Load realtime reviews for the public Reviews tab (data submitted by logged-in Firebase users)
    loadReviewsRealtime();

    const isAdminPage = document.querySelector('.admin-shell') || document.getElementById('dashboard');
    if (isAdminPage) {
        // Admin dashboard login (custom) will call initAdminPortal after successful custom login
    } else {
        setupClientAuthUI();
    }
});

function observeScrollMotion(video) {
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                // Subtle parallax for full-page background video (moves slower than content)
                const offset = window.scrollY * 0.08;
                video.style.transform = `translate3d(0, ${offset}px, 0) scale(1.05)`;
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
    if (currentUser) {
        // If signed in, use quick request or prefill full form
        showToast(`Selected: ${serviceName}. Using Quick Request or full form below.`);
        // Try to select in quick pills if visible
        const quick = document.getElementById('quick-request');
        if (quick && quick.style.display !== 'none') {
            selectQuickService(serviceName);
        } else {
            // fallback to full form
            const sel = document.getElementById('client-service');
            if (sel) sel.value = serviceName;
            const estimate = document.getElementById('estimate');
            if (estimate) estimate.scrollIntoView({ behavior: 'smooth' });
        }
    } else {
        showToast(`Selected: ${serviceName}. Please Sign In / Sign Up to submit quickly.`);
        openSignIn();
    }
}

// Enhanced submit for full intake form (works for guests too but requires login)
async function submitIntakeForm() {
    let name = document.getElementById('client-name').value.trim();
    let email = document.getElementById('client-email').value.trim();
    let phone = document.getElementById('client-phone').value.trim();
    let address = document.getElementById('client-address').value.trim();
    const service = document.getElementById('client-service').value;
    const details = document.getElementById('client-details').value.trim();
    const serviceDatetime = document.getElementById('service-datetime').value;

    // Prefer saved profile if available (for signed in users)
    if (currentUser && userProfile) {
        if (userProfile.fullName) name = userProfile.fullName;
        if (userProfile.email) email = userProfile.email;
        if (userProfile.phone) phone = userProfile.phone;
        if (userProfile.address) address = userProfile.address;
    }

    if (!name || !email || !phone || !address) {
        showToast('Please complete all required fields before submitting.');
        return;
    }

    if (!currentUser) {
        showToast('Please login or create an account to submit intake.');
        toggleAuthModal();
        return;
    }

    try {
        await addDoc(collection(db, 'submissions'), {
            id: Date.now(),
            name,
            email,
            phone,
            address,
            service,
            details,
            serviceDatetime: serviceDatetime || new Date().toISOString(),
            paid: false,
            status: 'New',
            submittedAt: new Date().toLocaleString(),
            uid: currentUser.uid,
            timestamp: serverTimestamp()
        });
        resetIntakeFields();
        showToast('Intake request received! It will appear in the admin portal in real-time.');
    } catch (err) {
        console.error(err);
        showToast('Error submitting intake. Please try again.');
    }
}

function resetIntakeFields() {
    const fields = ['client-name', 'client-email', 'client-phone', 'client-address', 'client-details'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const dt = document.getElementById('service-datetime');
    if (dt) dt.value = '';
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

// ===================== AUTH UI + QUICK REQUEST (new for signed-in users) =====================

function updateUserUI(user) {
    const topnav = document.querySelector('.topnav');
    if (!topnav) return;

    // Remove any previous dynamic auth elements
    const existingAuth = topnav.querySelectorAll('.dynamic-auth');
    existingAuth.forEach(el => el.remove());

    const quickSection = document.getElementById('quick-request');

    if (user) {
        // Hide the static Sign In / Sign Up buttons if they are still the original ones
        // (we will hide the last two children that are the buttons added in HTML)
        const buttons = Array.from(topnav.querySelectorAll('button'));
        buttons.slice(-2).forEach(b => { if (b.textContent.includes('Sign')) b.style.display = 'none'; });

        // Add greeting + Logout
        const greeting = document.createElement('span');
        greeting.className = 'dynamic-auth';
        greeting.style.cssText = 'color:var(--gold); font-weight:600; margin-left:0.6rem;';
        const display = (userProfile && userProfile.fullName) || user.displayName || user.email.split('@')[0];
        greeting.textContent = `Hi, ${display}`;

        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'button button-secondary dynamic-auth';
        logoutBtn.style.cssText = 'padding:0.45rem 0.85rem; font-size:0.78rem; margin-left:0.4rem;';
        logoutBtn.textContent = 'Logout';
        logoutBtn.onclick = async () => {
            try {
                await signOut(auth);
                showToast('Signed out.');
                // Re-show original sign buttons
                buttons.slice(-2).forEach(b => b.style.display = '');
            } catch (e) { console.error(e); }
        };

        topnav.appendChild(greeting);
        topnav.appendChild(logoutBtn);

        // Show Quick Request section (profile details "set" via auth user)
        if (quickSection) {
            const hasFullProfile = userProfile && userProfile.phone && userProfile.address;
            if (hasFullProfile) {
                quickSection.style.display = 'block';
                updateQuickRequestWithProfile();
                populateQuickServicePills();
            } else {
                quickSection.style.display = 'none';
                // Prompt to complete profile
                setTimeout(() => {
                    showProfileModal({
                        fullName: user.displayName || '',
                        email: user.email || ''
                    });
                }, 600);
            }
        }

        // Also prefill the full intake form for convenience (always prefer profile if logged in)
        const nameEl = document.getElementById('client-name');
        const emailEl = document.getElementById('client-email');
        const phoneEl = document.getElementById('client-phone');
        const addrEl = document.getElementById('client-address');
        if (nameEl) nameEl.value = (userProfile && userProfile.fullName) || user.displayName || nameEl.value || '';
        if (emailEl) emailEl.value = (userProfile && userProfile.email) || user.email || emailEl.value || '';
        if (phoneEl) phoneEl.value = (userProfile && userProfile.phone) || phoneEl.value || '';
        if (addrEl) addrEl.value = (userProfile && userProfile.address) || addrEl.value || '';

        // Prefill review name from profile
        const reviewNameEl = document.getElementById('review-name');
        if (reviewNameEl) reviewNameEl.value = (userProfile && userProfile.fullName) || user.displayName || reviewNameEl.value || '';

    } else {
        // Not signed in: show original buttons (they were hidden on sign-in)
        const buttons = Array.from(topnav.querySelectorAll('button'));
        buttons.slice(-2).forEach(b => b.style.display = '');

        if (quickSection) {
            quickSection.style.display = 'none';
        }
        userProfile = null;
    }
}

function populateQuickServicePills() {
    const container = document.getElementById('quick-service-pills');
    if (!container) return;
    container.innerHTML = '';

    const services = [
        'Property Inspections', 'Eviction Cleanouts', 'Roofing Repairs',
        'Grass Cutting & Shrub Trimming', 'Rental Turnovers', 'Storm Damage Cleanup',
        'Interior Renovations', 'General Maintenance'
    ];

    services.forEach(svc => {
        const btn = document.createElement('button');
        btn.className = 'button button-secondary';
        btn.style.cssText = 'padding:0.35rem 0.8rem; font-size:0.82rem; border-radius:999px;';
        btn.textContent = svc;
        btn.onclick = () => selectQuickService(svc, btn);
        container.appendChild(btn);
    });
}

function selectQuickService(serviceName, clickedBtn = null) {
    selectedQuickService = serviceName;
    const container = document.getElementById('quick-service-pills');
    if (container) {
        Array.from(container.children).forEach(b => {
            b.style.borderColor = (b === clickedBtn) ? 'var(--gold)' : 'rgba(255,255,255,0.12)';
            b.style.color = (b === clickedBtn) ? 'var(--gold)' : '';
        });
    }
    showToast(`Quick service selected: ${serviceName}`);
}

async function submitQuickRequest() {
    if (!currentUser) {
        showToast('Please sign in first.');
        return;
    }
    if (!selectedQuickService) {
        showToast('Please select a service from the pills above.');
        return;
    }
    if (!userProfile || !userProfile.phone || !userProfile.address) {
        showToast('Please complete your profile first.');
        showProfileModal();
        return;
    }

    const detailsEl = document.getElementById('quick-details');
    const datetimeEl = document.getElementById('quick-datetime');
    const details = detailsEl ? detailsEl.value.trim() : '';
    const serviceDatetime = datetimeEl ? datetimeEl.value : new Date().toISOString();

    // Use saved profile
    const name = userProfile.fullName || currentUser.displayName || currentUser.email.split('@')[0];
    const email = userProfile.email || currentUser.email;
    const phone = userProfile.phone;
    const address = userProfile.address;

    try {
        await addDoc(collection(db, 'submissions'), {
            id: Date.now(),
            name,
            email,
            phone,
            address,
            service: selectedQuickService,
            details: details || '',
            serviceDatetime: serviceDatetime || new Date().toISOString(),
            paid: false,
            status: 'New',
            submittedAt: new Date().toLocaleString(),
            uid: currentUser.uid,
            timestamp: serverTimestamp(),
            source: 'quick-request'
        });

        showToast('Service request submitted successfully! Our team will contact you shortly to confirm scheduling and payment.');
        if (detailsEl) detailsEl.value = '';
        if (datetimeEl) datetimeEl.value = '';
        selectedQuickService = null;

        // Reset pill styles
        const container = document.getElementById('quick-service-pills');
        if (container) Array.from(container.children).forEach(b => { b.style.borderColor = ''; b.style.color = ''; });
    } catch (err) {
        console.error(err);
        showToast('Request submit failed. Please try again or use the full form.');
    }
}

// ===================== USER PROFILE SYSTEM (one-time on signup, used for quick requests) =====================

async function loadUserProfile(uid) {
    if (!uid || !db) return null;
    try {
        const docRef = doc(db, 'userProfiles', uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            userProfile = snap.data();
            return userProfile;
        }
        return null;
    } catch (e) {
        console.error('Error loading profile:', e);
        return null;
    }
}

async function saveUserProfile(uid, data) {
    if (!uid || !db) return false;
    try {
        const docRef = doc(db, 'userProfiles', uid);
        await setDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp()
        }, { merge: true });
        userProfile = data;
        return true;
    } catch (e) {
        console.error('Error saving profile:', e);
        return false;
    }
}

function showProfileModal(prefill = {}) {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;

    // Prefill what we have
    const nameEl = document.getElementById('profile-fullname');
    const emailEl = document.getElementById('profile-email');
    const phoneEl = document.getElementById('profile-phone');
    const addrEl = document.getElementById('profile-address');

    if (nameEl) nameEl.value = prefill.fullName || (currentUser && currentUser.displayName) || '';
    if (emailEl) emailEl.value = prefill.email || (currentUser && currentUser.email) || '';
    if (phoneEl) phoneEl.value = prefill.phone || '';
    if (addrEl) addrEl.value = prefill.address || '';

    modal.style.display = 'flex';
}

async function saveProfileAndClose() {
    const modal = document.getElementById('profile-modal');
    const msgEl = document.getElementById('profile-message');
    if (!modal || !currentUser) return;

    const fullName = document.getElementById('profile-fullname').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();
    const address = document.getElementById('profile-address').value.trim();

    if (!fullName || !email || !phone || !address) {
        if (msgEl) msgEl.textContent = 'Please fill in all fields.';
        return;
    }

    const profileData = { fullName, email, phone, address };

    const saved = await saveUserProfile(currentUser.uid, profileData);
    if (saved) {
        if (msgEl) msgEl.style.color = 'var(--gold)';
        if (msgEl) msgEl.textContent = 'Profile saved! You can now use Quick Requests.';
        setTimeout(() => {
            modal.style.display = 'none';
            // Refresh UI with profile
            updateUserUI(currentUser);
            showToast('Profile complete. Quick service requests are now enabled.');
        }, 900);
    } else {
        if (msgEl) msgEl.textContent = 'Failed to save profile. Please try again.';
    }
}

function updateQuickRequestWithProfile() {
    const quickSection = document.getElementById('quick-request');
    const summaryEl = document.getElementById('quick-profile-summary');
    if (!quickSection || !summaryEl || !currentUser || !userProfile) return;

    summaryEl.innerHTML = `
        <strong>${userProfile.fullName || currentUser.displayName || 'User'}</strong><br>
        ${userProfile.email || currentUser.email}<br>
        ${userProfile.phone || ''}<br>
        <small>${userProfile.address || 'Address on file'}</small>
    `;

    // Suggest a date 48 hours from now for convenience
    const dtEl = document.getElementById('quick-datetime');
    if (dtEl && !dtEl.value) {
        const suggested = new Date(Date.now() + 48 * 60 * 60 * 1000);
        const iso = suggested.toISOString().slice(0, 16);
        dtEl.value = iso;
    }

    // Prefill review form name if available
    const reviewNameEl = document.getElementById('review-name');
    if (reviewNameEl && !reviewNameEl.value && userProfile.fullName) {
        reviewNameEl.value = userProfile.fullName;
    }
}

// ===================== ADMIN (cleaned - NO mock data, no seeding) =====================

function initAdminPortal() {
    if (!document.getElementById('service-list')) return;

    // Clean reference list of what Nash Services actually offers (no mocks, no demo defaults)
    renderServices(coreOfferedServices);

    // Real-time listener for submissions ONLY (no seeding)
    if (submissionsListener) submissionsListener();

    const q = query(collection(db, 'submissions'), orderBy('timestamp', 'desc'));
    submissionsListener = onSnapshot(q, (snapshot) => {
        const submissions = [];
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            submissions.push({
                ...data,
                id: data.id || docSnap.id,
                docId: docSnap.id
            });
        });
        renderSubmissions(submissions, currentSubmissionFilter);
        updateMetrics(submissions);
    }, (error) => {
        console.error('Firestore listener error:', error);
        showToast('Live updates unavailable. Using cached view if any.');
    });
}

function renderServices(services) {
    const serviceList = document.getElementById('service-list');
    if (!serviceList) return;

    serviceList.innerHTML = services.map(service => `
        <div class="list-item">
            <h4>${service.name}</h4>
            <span>${service.notes}</span>
            <div style="margin-top:0.4rem;">
                <span class="status-pill active">Offered</span>
            </div>
        </div>
    `).join('');
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
        const docIdentifier = item.docId || item.id || '';
        return `
            <div class="list-item">
                <h4>${item.name} — ${item.service}</h4>
                <span>${item.email} · ${item.phone}</span>
                <p>${item.address} | Service: ${dateStr}</p>
                <p>${item.details || 'No additional notes provided.'}</p>
                <div style="margin-top:0.8rem; display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center;">
                    <span class="status-pill ${item.status === 'New' ? 'active' : 'done'}">${item.status}</span>
                    <span class="paid-pill ${paidStatus}">${item.paid ? 'Paid' : 'Unpaid'}</span>
                    <button class="button button-secondary" onclick="togglePaidStatus('${docIdentifier}')">Toggle Paid</button>
                    <button class="button button-secondary" onclick="completeSubmission('${docIdentifier}')">Mark Complete</button>
                </div>
            </div>
        `;
    }).join('') || '<div class="list-item"><p style="color:var(--muted)">No submissions yet. Real client requests will appear here live.</p></div>';
}

function updateMetrics(submissions = []) {
    const serviceCount = document.getElementById('service-count');
    const submissionCount = document.getElementById('submission-count');
    const dispatchCount = document.getElementById('dispatch-count');
    const clientCount = document.getElementById('client-count');

    if (serviceCount) serviceCount.textContent = coreOfferedServices.length;
    if (submissionCount) submissionCount.textContent = submissions.filter(item => item.status === 'New').length;
    if (dispatchCount) dispatchCount.textContent = submissions.filter(item => item.status !== 'New').length;
    const uniqueClients = new Set(submissions.map(s => s.email)).size;
    if (clientCount) clientCount.textContent = uniqueClients || 0;
}

function filterSubmissions(filter) {
    currentSubmissionFilter = filter;
    const buttons = document.querySelectorAll('#submission-filters .filter-btn');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === filter || 
            (filter === 'all' && btn.textContent === 'All'));
    });
    initAdminPortal();
}

async function togglePaidStatus(identifier) {
    if (!identifier || !db) return;
    try {
        let targetDoc = null;
        if (identifier.length > 10) {
            targetDoc = doc(db, 'submissions', identifier);
        } else {
            const snap = await getDocs(query(collection(db, 'submissions'), where('id', '==', parseInt(identifier) || identifier)));
            if (!snap.empty) targetDoc = snap.docs[0].ref;
        }
        if (targetDoc) {
            const currentSnap = await getDoc(targetDoc);
            const currentPaid = currentSnap.exists() ? (currentSnap.data().paid || false) : false;
            await updateDoc(targetDoc, { paid: !currentPaid });
            showToast(`Marked as ${!currentPaid ? 'Paid' : 'Unpaid'}.`);
        }
    } catch (err) {
        console.error(err);
        showToast('Toggle failed. Check console.');
    }
}

function saveServicePackage() {
    const name = document.getElementById('new-service-name').value.trim();
    const rate = document.getElementById('new-service-rate').value.trim();
    const notes = document.getElementById('new-service-notes').value.trim();

    if (!name || !rate) {
        showToast('Please provide both name and rate for the service package.');
        return;
    }

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
    initAdminPortal();
    showToast('Service package added (local to this browser for admin reference).');
}

async function completeSubmission(identifier) {
    if (!identifier) return;
    try {
        let target = null;
        if (identifier.length > 10) {
            target = doc(db, 'submissions', identifier);
        } else {
            const snap = await getDocs(query(collection(db, 'submissions'), where('id', '==', parseInt(identifier) || identifier)));
            if (!snap.empty) target = snap.docs[0].ref;
        }
        if (target) {
            await updateDoc(target, { status: 'Completed' });
            showToast('Submission marked Completed (live).');
        }
    } catch (err) {
        console.error(err);
        showToast('Update failed.');
    }
}

// Removed addMockService entirely (no more mock data)

async function clearAllData() {
    if (!confirm('Clear ALL submissions from Firestore? This cannot be undone.')) return;
    localStorage.removeItem('nash_services');
    try {
        const snapshot = await getDocs(collection(db, 'submissions'));
        const delPromises = [];
        snapshot.forEach((d) => {
            delPromises.push( (async () => { try { await deleteDoc(d.ref); } catch(e){} })() );
        });
        await Promise.all(delPromises);
        initAdminPortal();
        showToast('All submissions cleared from Firestore.');
    } catch (e) {
        console.error(e);
        showToast('Clear failed - check console / permissions.');
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
        showToast('Successfully logged in as Administrator.');
    } else {
        errorEl.textContent = 'Invalid username or password. Please try again.';
        document.getElementById('password').value = '';
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

// Shake style (keep)
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

// AI Widget (kept, fallback already improved for new branding)
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
    bodyEl.innerHTML += `<div class="ai-message user">${prompt}</div>`;
    bodyEl.scrollTop = bodyEl.scrollHeight;
    input.value = '';

    const typingId = 'typing-' + Date.now();
    bodyEl.innerHTML += `<div id="${typingId}" class="ai-message bot">Thinking with Grok...</div>`;
    bodyEl.scrollTop = bodyEl.scrollHeight;

    try {
        const response = await fetch('/api/ai-recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: prompt,
                context: currentUser ? `Signed-in user: ${currentUser.email}. Quick requests + full intake available.` : 'Visitor. Property preservation, construction, lawn, cleanouts, rehab in the Detroit metro and Southeast Michigan area.'
            })
        });
        const data = await response.json();
        
        const typing = document.getElementById(typingId);
        if (typing) typing.remove();
        
        const botMsg = data.recommendation || data.error || 'Sorry, I could not generate a recommendation at this time.';
        bodyEl.innerHTML += `<div class="ai-message bot">${botMsg.replace(/\n/g, '<br>')}</div>`;
    } catch (err) {
        console.error(err);
        const typing = document.getElementById(typingId);
        if (typing) typing.innerHTML = 'AI backend unavailable (local preview mode). Curtis Nash provides full property preservation, construction &amp; rehab, cleanouts, lawn care, and emergency services across the Detroit metro and Southeast Michigan area.';
    }
    bodyEl.scrollTop = bodyEl.scrollHeight;
}

function setupClientAuthUI() {
    console.log('Client auth ready (modular Firebase). Sign In/Up buttons in nav now support quick requests after login.');
}

// Modal functions (kept compatible)
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
        await signInWithEmailAndPassword(auth, email, password);
        messageEl.style.color = 'var(--gold)';
        messageEl.textContent = 'Login successful!';
        setTimeout(() => {
            toggleAuthModal();
            // If no full profile yet, prompt (handled in updateUserUI too)
        }, 800);
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
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
            await updateProfile(userCred.user, { displayName: name });
        }
        messageEl.style.color = 'var(--gold)';
        messageEl.textContent = 'Account created! Please complete your project profile.';
        setTimeout(() => {
            toggleAuthModal();
            // Show profile completion right after signup
            showProfileModal({ fullName: name, email: email });
        }, 900);
    } catch (error) {
        messageEl.textContent = error.message || 'Signup failed. Please try again.';
    }
}

// Top nav helpers (called from onclick in index.html)
function openSignIn() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  switchAuthTab(0);
  const msg = document.getElementById('auth-message');
  if (msg) msg.textContent = '';
}

function openSignUp() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  switchAuthTab(1);
  const msg = document.getElementById('auth-message');
  if (msg) msg.textContent = '';
}

// Expose key functions globally for inline onclick (admin.html + index nav)
window.submitQuickRequest = submitQuickRequest;
window.selectQuickService = selectQuickService;
window.initAdminPortal = initAdminPortal;
window.clearAllData = clearAllData;
window.filterSubmissions = filterSubmissions;
window.attemptLogin = attemptLogin;
window.logout = logout;
window.togglePaidStatus = togglePaidStatus;
window.completeSubmission = completeSubmission;
window.saveServicePackage = saveServicePackage;
window.saveServicePackageFromAdmin = saveServicePackage;
window.openSignIn = openSignIn;
window.openSignUp = openSignUp;
window.showProfileModal = showProfileModal;
window.saveProfileAndClose = saveProfileAndClose;

function selectServiceAndGo(serviceName) {
    if (currentUser && userProfile && userProfile.phone && userProfile.address) {
        // Signed in with complete profile → use quick request flow (no full intake redo)
        const quickSection = document.getElementById('quick-request');
        if (quickSection) {
            quickSection.style.display = 'block';
            quickSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            updateQuickRequestWithProfile();
            // Ensure pills are populated
            const container = document.getElementById('quick-service-pills');
            if (container && container.children.length === 0) {
                populateQuickServicePills();
            }
        }
        selectQuickService(serviceName);
        showToast('Service selected for quick request. Choose date/time and add notes, then submit.');
        return;
    }

    // Fallback: prefill the full estimate form (for guests or incomplete profile)
    const select = document.getElementById('client-service');
    if (select) {
        let found = false;
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === serviceName || select.options[i].text.includes(serviceName.split(' ')[0])) {
                select.selectedIndex = i;
                found = true;
                break;
            }
        }
        if (!found) select.value = select.options[0].value;
    }
    // If signed in but no profile yet, also try quick pills
    if (currentUser) {
        const quick = document.getElementById('quick-request');
        if (quick && quick.style.display !== 'none') {
            selectQuickService(serviceName);
        }
    }
    // Scroll to estimate
    const estimateSection = document.getElementById('estimate');
    if (estimateSection) estimateSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (typeof showToast === 'function') {
        showToast('Service selected: ' + serviceName + '. ' + (currentUser ? 'Complete profile or use full form.' : 'Sign in for faster requests.'));
    }
}
window.selectServiceAndGo = selectServiceAndGo;

// ===================== REVIEWS FUNCTIONALITY =====================

function submitReview() {
    const statusEl = document.getElementById('review-status');

    if (!currentUser) {
        if (statusEl) {
            statusEl.style.color = '#f87171';
            statusEl.textContent = 'Please sign in to leave a review.';
        }
        showToast('Please sign in to submit a review.');
        return;
    }

    const name = document.getElementById('review-name').value.trim();
    const rating = document.getElementById('review-rating').value;
    const service = document.getElementById('review-service').value;
    const text = document.getElementById('review-text').value.trim();

    if (!name || !text) {
        if (statusEl) {
            statusEl.style.color = '#f87171';
            statusEl.textContent = 'Please enter your name and review text.';
        }
        return;
    }

    // Use profile name if available
    let displayName = name;
    if (userProfile && userProfile.fullName) {
        displayName = userProfile.fullName;
    }

    // Save to Firestore (realtime listener will update the UI)
    addDoc(collection(db, 'reviews'), {
        name: displayName,
        rating: parseInt(rating),
        service: service,
        text: text,
        uid: currentUser.uid,
        timestamp: serverTimestamp()
    }).then(() => {
        // Clear form and show success
        document.getElementById('review-name').value = '';
        document.getElementById('review-text').value = '';
        if (statusEl) {
            statusEl.style.color = 'var(--gold)';
            statusEl.textContent = 'Thank you! Your review has been submitted and will appear shortly.';
            setTimeout(() => {
                if (statusEl) statusEl.textContent = '';
            }, 3000);
        }
        showToast('Review submitted successfully!');
    }).catch(err => {
        console.error(err);
        if (statusEl) {
            statusEl.style.color = '#f87171';
            statusEl.textContent = 'Failed to submit review. Please try again.';
        }
    });
}

// ===================== REVIEWS REALTIME FROM FIREBASE (for logged-in users' submissions) =====================

function loadReviewsRealtime() {
  if (!db) return;

  if (reviewsListener) {
    reviewsListener(); // unsubscribe previous if any
  }

  const q = query(collection(db, 'reviews'), orderBy('timestamp', 'desc'));

  reviewsListener = onSnapshot(q, (snapshot) => {
    renderReviews(snapshot);
  }, (error) => {
    console.error('Reviews realtime listener error:', error);
    // Don't spam toast for public tab
  });
}

function renderReviews(snapshot) {
  const container = document.getElementById('reviews-grid');
  const noMsg = document.getElementById('no-reviews-msg');
  if (!container) return;

  container.innerHTML = '';

  if (snapshot.empty) {
    if (noMsg) noMsg.style.display = 'block';
    return;
  } else {
    if (noMsg) noMsg.style.display = 'none';
  }

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const rating = data.rating || 5;
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);

    const card = document.createElement('div');
    card.className = 'feature-card';
    card.innerHTML = `
      <span style="color: var(--gold);">${stars}</span>
      <p>"${data.text || ''}"</p>
      <strong>— ${data.name || 'Anonymous User'}</strong>
      <small style="color: var(--muted);">${data.service || ''}</small>
    `;
    container.appendChild(card);
  });
}

// Expose
window.submitReview = submitReview;
