class WorkflowEngine {
    // The strict matrix of legal state transitions for an Application
    static APPLICATION_TRANSITIONS = {
        'DRAFT': ['SUBMITTED', 'WITHDRAWN'],
        'SUBMITTED': ['UNDER_REVIEW', 'DOCUMENT_PENDING', 'APPROVED', 'REJECTED'],
        'DOCUMENT_PENDING': ['REUPLOAD_REQUIRED', 'SUBMITTED'],
        'REUPLOAD_REQUIRED': ['SUBMITTED'],
        'UNDER_REVIEW': ['INTERVIEW_SCHEDULED', 'TEST_SCHEDULED', 'WAITLISTED', 'APPROVED', 'REJECTED'],
        'APPROVED': ['ENROLLED', 'WITHDRAWN'], // Notice: APPROVED can ONLY go to ENROLLED or WITHDRAWN
        'WAITLISTED': ['APPROVED', 'REJECTED'],
        'ENROLLED': [], // Terminal state for the application
        'REJECTED': ['ARCHIVED'],
        'WITHDRAWN': ['ARCHIVED'],
        'ARCHIVED': []
    };

    /**
     * Validates if a state transition is legally allowed.
     * @param {String} entityType - e.g., 'APPLICATION'
     * @param {String} currentStatus - e.g., 'SUBMITTED'
     * @param {String} targetStatus - e.g., 'APPROVED'
     */
    static validateTransition(entityType, currentStatus, targetStatus) {
        if (entityType === 'APPLICATION') {
            const allowedNextStates = this.APPLICATION_TRANSITIONS[currentStatus];
            
            if (!allowedNextStates) {
                throw new Error(`Workflow Error: Unknown current state '${currentStatus}'.`);
            }

            if (!allowedNextStates.includes(targetStatus)) {
                throw new Error(`Workflow Violation: Cannot transition Application from '${currentStatus}' directly to '${targetStatus}'.`);
            }
        }
        
        // Future: Add STUDENT_TRANSITIONS, INVOICE_TRANSITIONS, etc.
        return true;
    }
}

module.exports = WorkflowEngine;