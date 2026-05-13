const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1', // Mumbai region by default
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

const generatePresignedUrl = async (fileName, fileType) => {
    // Clean filename and add a unique timestamp to prevent overwriting
    const uniqueFileName = `${Date.now()}-${fileName.replace(/\s+/g, '-')}`;
    
    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: `school-app/admissions/documents/${uniqueFileName}`,
        ContentType: fileType,
    });

    // URL expires in 5 minutes (300 seconds)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    return {
        uploadUrl,
        fileKey: `school-app/admissions/documents/${uniqueFileName}` // Save this key in your DB!
    };
};

module.exports = { generatePresignedUrl };