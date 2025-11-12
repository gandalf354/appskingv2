const { executeQuery } = require('../config/database');

const updateEmail = async (id, email) => {
  try {
    // Check if email is already used
    const existing = await executeQuery('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
    if (existing.length > 0) {
      console.error('Email already in use by another user');
      process.exit(2);
    }

    await executeQuery('UPDATE users SET email = ?, updated_at = NOW() WHERE id = ?', [email, id]);
    const users = await executeQuery('SELECT id, name, email, role, phone, is_active, created_at FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      console.error('User not found');
      process.exit(3);
    }
    console.log(JSON.stringify(users[0], null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error updating email:', err.message || err);
    process.exit(1);
  }
};

const [,, id, email] = process.argv;
if (!id || !email) {
  console.error('Usage: node updateUserEmail.js <id> <email>');
  process.exit(1);
}

updateEmail(parseInt(id, 10), email);
