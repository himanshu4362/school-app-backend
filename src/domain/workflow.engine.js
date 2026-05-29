class WorkflowEngine {
    static APPLICATION_TRANSITIONS = {
        'DRAFT': { allowed: ['PARENT', 'ADMIN', 'SUPER_ADMIN'], next: ['SUBMITTED'] },

        'SUBMITTED': { allowed: ['ADMIN', 'ADMISSION_OFFICER', 'SUPER_ADMIN'], next: ['UNDER_REVIEW', 'DOCUMENT_PENDING', 'REJECTED'] },

        'DOCUMENT_PENDING': { allowed: ['PARENT', 'ADMIN', 'ADMISSION_OFFICER', 'SUPER_ADMIN'], next: ['SUBMITTED', 'REUPLOAD_REQUIRED', 'UNDER_REVIEW', 'REJECTED'] },

        'REUPLOAD_REQUIRED': { allowed: ['PARENT', 'ADMIN', 'ADMISSION_OFFICER', 'SUPER_ADMIN'], next: ['SUBMITTED', 'DOCUMENT_PENDING'] },

        'UNDER_REVIEW': { allowed: ['ADMISSION_OFFICER', 'PRINCIPAL', 'SUPER_ADMIN'], next: ['APPROVED', 'REJECTED', 'WAITLISTED', 'DOCUMENT_PENDING', 'INTERVIEW_SCHEDULED', 'TEST_SCHEDULED'] },

        'INTERVIEW_SCHEDULED': { allowed: ['ADMISSION_OFFICER', 'PRINCIPAL', 'SUPER_ADMIN'], next: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'] },

        'TEST_SCHEDULED': { allowed: ['ADMISSION_OFFICER', 'PRINCIPAL', 'SUPER_ADMIN'], next: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'] },

        'WAITLISTED': { allowed: ['ADMISSION_OFFICER', 'PRINCIPAL', 'SUPER_ADMIN'], next: ['APPROVED', 'REJECTED', 'WITHDRAWN'] },

        'APPROVED': { allowed: ['PRINCIPAL', 'SUPER_ADMIN'], next: ['ENROLLED', 'WITHDRAWN', 'DOCUMENT_PENDING'] },

        // Terminal states
        'ENROLLED': { allowed: [], next: [] },
        'REJECTED': { allowed: ['SUPER_ADMIN'], next: ['UNDER_REVIEW'] },
        'WITHDRAWN': { allowed: ['SUPER_ADMIN'], next: [] },
        'EXPIRED': { allowed: ['SYSTEM', 'SUPER_ADMIN'], next: [] },
        'ARCHIVED': { allowed: ['SUPER_ADMIN'], next: [] }
    };

    static validateTransition(entityType, currentStatus, targetStatus, actorRole) {
        if (entityType === 'APPLICATION') {
            const stateConfig = this.APPLICATION_TRANSITIONS[currentStatus];
            if (!stateConfig) throw new Error(`Workflow Error: Invalid state '${currentStatus}'.`);

            if (!stateConfig.allowed.includes(actorRole)) {
                throw new Error(`Authority Error: Role '${actorRole}' is not authorized to transition application from '${currentStatus}'.`);
            }

            if (!stateConfig.next.includes(targetStatus)) {
                throw new Error(`Workflow Violation: Cannot transition from '${currentStatus}' to '${targetStatus}'.`);
            }

            return true;
        }
    }
}

module.exports = WorkflowEngine;