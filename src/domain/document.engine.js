class DocumentEngine {
    static REQUIREMENT_MATRIX = {
        'fresh': {
            'GENERAL': ['BIRTH_CERTIFICATE', 'NATIONAL_ID', 'ADDRESS_PROOF'],
            'OBC': ['BIRTH_CERTIFICATE', 'NATIONAL_ID', 'ADDRESS_PROOF', 'CASTE_CERTIFICATE'],
            'SC': ['BIRTH_CERTIFICATE', 'NATIONAL_ID', 'ADDRESS_PROOF', 'CASTE_CERTIFICATE'],
            // etc...
        },
        'transfer': {
            'GENERAL': ['TRANSFER_CERTIFICATE', 'PREVIOUS_MARKSHEET', 'NATIONAL_ID', 'ADDRESS_PROOF'],
            'EWS': ['TRANSFER_CERTIFICATE', 'PREVIOUS_MARKSHEET', 'NATIONAL_ID', 'ADDRESS_PROOF', 'INCOME_CERTIFICATE'],
            // etc...
        }
    };

    /**
     * Returns the array of required document types.
     */
    static getRequiredList(admissionType, category = 'GENERAL') {
        const typeMatrix = this.REQUIREMENT_MATRIX[admissionType];
        if (!typeMatrix) throw new Error(`Unknown admission type: ${admissionType}`);
        return typeMatrix[category] || typeMatrix['GENERAL'];
    }

    /**
     * Validates an application's uploaded documents against the matrix.
     */
    static validateSubmission(admissionType, category, uploadedDocuments) {
        const requiredDocs = this.getRequiredList(admissionType, category);
        
        // Filter to only documents that are actually uploaded/submitted
        const validUploads = uploadedDocuments.filter(doc => 
            ['SUBMITTED', 'VERIFIED'].includes(doc.status) && doc.fileKey
        ).map(doc => doc.documentType);

        const missingDocs = requiredDocs.filter(req => !validUploads.includes(req));

        if (missingDocs.length > 0) {
            throw new Error(`Document Validation Error: Missing mandatory documents for ${admissionType} (${category}): ${missingDocs.join(', ')}`);
        }
        return true;
    }
}

module.exports = DocumentEngine;