// debug-email.js - Test email configuration
require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('=== EMAIL CONFIGURATION DEBUG ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS exists:', !!process.env.EMAIL_PASS);
console.log('EMAIL_PASS length:', process.env.EMAIL_PASS?.length);
console.log('EMAIL_PASS preview:', process.env.EMAIL_PASS?.substring(0, 4) + '...');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ EMAIL credentials tidak lengkap!');
    console.log('📝 Pastikan file .env berisi:');
    console.log('EMAIL_USER=yafilala2@gmail.com');
    console.log('EMAIL_PASS=your-16-digit-app-password');
    process.exit(1);
}

console.log('\n=== TESTING TRANSPORTER CREATION ===');

try {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    console.log('✅ Transporter berhasil dibuat');

    // Test connection
    console.log('🔄 Testing connection...');
    transporter.verify((error, success) => {
        if (error) {
            console.error('❌ Connection failed:', error.message);
            console.log('\n🔧 Possible solutions:');
            console.log('1. Generate new App Password di Google Account');
            console.log('2. Enable 2-Factor Authentication');
            console.log('3. Pastikan menggunakan App Password, bukan regular password');
            console.log('4. Cek format: EMAIL_PASS=abcd efgh ijkl mnop (16 chars)');
        } else {
            console.log('✅ Email connection successful!');
            console.log('📧 Ready to send emails');
            
            // Optional: Send test email
            console.log('\n🚀 Sending test email...');
            transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: process.env.EMAIL_USER,
                subject: 'Test Email Configuration - KomikIn',
                text: 'Email configuration berhasil! OTP system siap digunakan.',
                html: `
                    <h2>✅ Email Configuration Success!</h2>
                    <p>Email system KomikIn berhasil dikonfigurasi.</p>
                    <p><strong>From:</strong> ${process.env.EMAIL_USER}</p>
                    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                `
            }, (err, info) => {
                if (err) {
                    console.error('❌ Send email failed:', err.message);
                } else {
                    console.log('✅ Test email sent successfully!');
                    console.log('📧 Check inbox:', process.env.EMAIL_USER);
                    console.log('Message ID:', info.messageId);
                }
            });
        }
    });

} catch (error) {
    console.error('❌ Transporter creation failed:', error.message);
}

console.log('\n=== DEBUG COMPLETE ===');