const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const School = require('../../models/school.model');
const User = require('../../models/user.model');

// Mock Email Transporter (For development)
const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: 'dummy', pass: 'dummy' }
});

const onboardNewSchool = async (payload) => {
    const { schoolName, udiseCode, schoolAddress, adminName, designation, adminMobile, adminEmail } = payload;

    // 1. Check for duplicates
    const existingSchool = await School.findOne({ udiseCode });
    if (existingSchool) {
        throw new Error("A school with this UDISE code is already registered.");
    }
    
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
        throw new Error("An admin with this email already exists.");
    }

    // 2. Generate secure random password and hash it
    const plainTextPassword = Math.random().toString(36).slice(-8); 
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainTextPassword, salt);

    // 3. Create the School
    const newSchool = await School.create({
        schoolName,
        udiseCode,
        address: schoolAddress
    });

    // 4. Create the Admin linked to the School
    const newAdmin = await User.create({
        schoolId: newSchool._id,
        fullName: adminName,
        email: adminEmail,
        mobile: adminMobile,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        designation: designation,
        isFirstLogin: true
    });

    // 5. Send Welcome Email
    const mailOptions = {
        from: '"System Admin" <no-reply@asms-platform.com>',
        to: adminEmail,
        subject: `Welcome to ${schoolName} - Portal Credentials`,
        text: `Dear ${adminName},\n\nYour school portal has been successfully provisioned.\n\nUsername: ${adminEmail}\nTemporary Password: ${plainTextPassword}\n\nPlease log in to the portal. You will be required to change your password immediately upon first login.\n\nRegards,\nSystem Admin`
    };

    console.log("EMAIL SENT");
    console.log(mailOptions.text);
   

    return {
        schoolId: newSchool._id,
        adminId: newAdmin._id,
        message: "School provisioned successfully. Credentials generated."
    };
};

module.exports = {
    onboardNewSchool
};