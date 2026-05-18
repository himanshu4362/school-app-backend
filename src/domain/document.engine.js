class DocumentEngine {

    static REQUIREMENT_MATRIX = {

        // =========================================
        // FRESH ADMISSION
        // =========================================

        'fresh': {

            // General students
            'GENERAL': [
                'AADHAAR',
                'BIRTH_CERTIFICATE',
                'ADDRESS_PROOF'
            ],

            // OBC
            'OBC': [
                'AADHAAR',
                'BIRTH_CERTIFICATE',
                'ADDRESS_PROOF',
                'CASTE_CERTIFICATE'
            ],

            // SC
            'SC': [
                'AADHAAR',
                'BIRTH_CERTIFICATE',
                'ADDRESS_PROOF',
                'CASTE_CERTIFICATE'
            ],

            // ST
            'ST': [
                'AADHAAR',
                'BIRTH_CERTIFICATE',
                'ADDRESS_PROOF',
                'CASTE_CERTIFICATE'
            ],

            // EWS
            'EWS': [
                'AADHAAR',
                'BIRTH_CERTIFICATE',
                'ADDRESS_PROOF',
                'INCOME_CERTIFICATE'
            ],

            // Other
            'OTHER': [
                'AADHAAR',
                'BIRTH_CERTIFICATE',
                'ADDRESS_PROOF'
            ]
        },

        // =========================================
        // TRANSFER ADMISSION
        // =========================================

        'transfer': {

            'GENERAL': [
                'AADHAAR',
                'TRANSFER_CERTIFICATE',
                'MARKSHEET',
                'ADDRESS_PROOF'
            ],

            'OBC': [
                'AADHAAR',
                'TRANSFER_CERTIFICATE',
                'MARKSHEET',
                'ADDRESS_PROOF',
                'CASTE_CERTIFICATE'
            ],

            'SC': [
                'AADHAAR',
                'TRANSFER_CERTIFICATE',
                'MARKSHEET',
                'ADDRESS_PROOF',
                'CASTE_CERTIFICATE'
            ],

            'ST': [
                'AADHAAR',
                'TRANSFER_CERTIFICATE',
                'MARKSHEET',
                'ADDRESS_PROOF',
                'CASTE_CERTIFICATE'
            ],

            'EWS': [
                'AADHAAR',
                'TRANSFER_CERTIFICATE',
                'MARKSHEET',
                'ADDRESS_PROOF',
                'INCOME_CERTIFICATE'
            ],

            'OTHER': [
                'AADHAAR',
                'TRANSFER_CERTIFICATE',
                'MARKSHEET',
                'ADDRESS_PROOF'
            ]
        }
    };

    static getRequiredList(admissionType, category = 'GENERAL') {

        category = String(category).toUpperCase();

        const typeMatrix = this.REQUIREMENT_MATRIX[admissionType];

        if (!typeMatrix) {
            throw new Error(`Unknown admission type: ${admissionType}`);
        }

        return typeMatrix[category] || typeMatrix['GENERAL'];
    }

    static validateSubmission(admissionType, category, uploadedDocuments = []) {

        const requiredDocs = this.getRequiredList(
            admissionType,
            category
        );

        const validUploads = uploadedDocuments
            .filter(doc =>
                ['SUBMITTED', 'VERIFIED'].includes(doc.status)
                && doc.fileKey
            )
            .map(doc => doc.documentType);

        const missingDocs = requiredDocs.filter(
            req => !validUploads.includes(req)
        );

        return {
            isValid: missingDocs.length === 0,
            missingDocs
        };
    }
}

module.exports = DocumentEngine;