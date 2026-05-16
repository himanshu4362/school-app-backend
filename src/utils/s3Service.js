// s3Service.js
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

// 🟢 Folder Structure: schools/{schoolId}/applications/{studentName}_{appId}/documents/
const generatePresignedUrl = async (schoolId, fileName, fileType, studentName = 'Unknown', applicationId = 'New') => {
    // S3 ke liye strings ko safe banaya (spaces hta kar underscores lagaye)
    const safeStudentName = studentName.replace(/[^a-zA-Z0-9]/g, '_');
    const uniqueFileName = `${Date.now()}-${fileName.replace(/\s+/g, '-')}`;
    
    // 🟢 PERFECT FOLDER NAMING RULE
    const fileKey = `schools/${schoolId}/applications/${safeStudentName}_${applicationId}/documents/${uniqueFileName}`;
    
    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileKey,
        ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    return { uploadUrl, fileKey };
};

const getPresignedDownloadUrl = async (fileKey) => {
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileKey,
    });
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
};

module.exports = { generatePresignedUrl, getPresignedDownloadUrl };