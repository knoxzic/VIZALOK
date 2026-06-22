document.getElementById('loginForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  if (email) {
    localStorage.setItem('vizalokLoggedIn', 'true');
    localStorage.setItem('userEmail', email);
    window.location.href = 'dashboard.html';
  }
});

function showSignup() {
  alert("Signup form would open here.\n\nWe can add real signup later with Firebase.");
}
