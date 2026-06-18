const { mongoose, Schema } = require('../config/db');

const messageSchema = new Schema({
    name: String,
    email: String,
    phone: String,
    subject: String,
    message: String,
    created_at: {
        type: Date,
        default: Date.now
    }
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;


class Message {
  static async create(messageData) {
    const { name, email } = messageData;
    // Ensure optional fields are set to null (not undefined) for SQL binding
    const phone = (messageData.phone === undefined) ? null : messageData.phone;
    const subject = (messageData.subject === undefined) ? null : messageData.subject;
    const message = messageData.message;
    console.log('Inserting message into DB:', { name, email, phone, subject, message });
    const [result] = await db.execute(
      'INSERT INTO messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone, subject, message]
    );
    return result.insertId;
  }

  static async findAll() {
    const [rows] = await db.execute(
      'SELECT * FROM messages ORDER BY created_at DESC'
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.execute(
      'SELECT * FROM messages WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  static async delete(id) {
    const [result] = await db.execute(
      'DELETE FROM messages WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = Message;
