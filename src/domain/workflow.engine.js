class WorkflowEngine {
    static APPLICATION_TRANSITIONS = {
        'DRAFT': { allowed: ['PARENT', 'ADMIN', 'SUPER_ADMIN'], next: ['SUBMITTED'] },
        'SUBMITTED': { allowed: ['PARENT', 'ADMIN', 'ADMISSION_OFFICER', 'SUPER_ADMIN'], next: ['UNDER_REVIEW', 'DOCUMENT_PENDING'] },
        'UNDER_REVIEW': { allowed: ['ADMISSION_OFFICER', 'PRINCIPAL', 'SUPER_ADMIN'], next: ['APPROVED', 'REJECTED', 'WAITLISTED'] },
        'APPROVED': { allowed: ['PRINCIPAL', 'SUPER_ADMIN'], next: ['ENROLLED', 'WITHDRAWN'] }, 
        'ENROLLED': { allowed: ['FINANCE', 'SYSADMIN', 'SUPER_ADMIN'], next: [] } 
    };

    static validateTransition(entityType, currentStatus, targetStatus, actorRole) {
        if (entityType === 'APPLICATION') {
            const stateConfig = this.APPLICATION_TRANSITIONS[currentStatus];
            if (!stateConfig) throw new Error(`Workflow Error: Invalid state '${currentStatus}'.`);
            
            // 1. Check Legal Transition
            if (!stateConfig.next.includes(targetStatus)) {
                throw new Error(`Workflow Violation: Cannot transition from '${currentStatus}' to '${targetStatus}'.`);
            }

            // 2. Check Authority Matrix
            const targetConfig = this.APPLICATION_TRANSITIONS[targetStatus];
            if (targetConfig && !targetConfig.allowed.includes(actorRole)) {
                throw new Error(`Authority Error: Role '${actorRole}' is not authorized to transition application to '${targetStatus}'.`);
            }
        }
        return true;
    }
}

module.exports = WorkflowEngine;