const bcrypt = require('bcryptjs');

const password = 'admin123';
const hash = '$2a$10$1E4cfwVt9G6WFN4lQJT.XOVTmG2niqbrfdnlYGK4/wuZGcqyzCQwi';

bcrypt.compare(password, hash, (err, result) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Password matches:', result);
  }
});

// Also test creating a new hash
bcrypt.hash(password, 12, (err, newHash) => {
  if (err) {
    console.error('Error creating hash:', err);
  } else {
    console.log('New hash for admin123:', newHash);
  }
});