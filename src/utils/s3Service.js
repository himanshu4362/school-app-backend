const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

const generatePresignedUrl = async (schoolId, fileName, fileType) => {
    const uniqueFileName = `${Date.now()}-${fileName.replace(/\s+/g, '-')}`;
    
    const fileKey = `schools/${schoolId}/admissions/documents/${uniqueFileName}`;
    
    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileKey,
        ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    return { uploadUrl, fileKey };
};

module.exports = { generatePresignedUrl };