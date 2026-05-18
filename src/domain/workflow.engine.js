class WorkflowEngine {
    static APPLICATION_TRANSITIONS = {
        'DRAFT': { allowed: ['PARENT', 'ADMIN', 'SUPER_ADMIN'], next: ['SUBMITTED'] },
        'SUBMITTED': { allowed: ['PARENT', 'ADMIN', 'ADMISSION_OFFICER', 'SUPER_ADMIN'], next: ['UNDER_REVIEW', 'DOCUMENT_PENDING'] },
        
        'DOCUMENT_PENDING': { allowed: ['PARENT', 'ADMIN', 'ADMISSION_OFFICER', 'SUPER_ADMIN'], next: ['SUBMITTED', 'UNDER_REVIEW', 'REJECTED'] },
        
        'UNDER_REVIEW': { allowed: ['ADMISSION_OFFICER', 'PRINCIPAL', 'SUPER_ADMIN'], next: ['APPROVED', 'REJECTED', 'WAITLISTED', 'DOCUMENT_PENDING'] },
        
        // 🟢 FIX: Added WAITLISTED config
        'WAITLISTED': { allowed: ['ADMISSION_OFFICER', 'PRINCIPAL', 'SUPER_ADMIN'], next: ['APPROVED', 'REJECTED', 'WITHDRAWN'] },
        
        'APPROVED': { allowed: ['PRINCIPAL', 'SUPER_ADMIN'], next: ['ENROLLED', 'WITHDRAWN', 'DOCUMENT_PENDING'] }, 
        
        // 🟢 FIX: Added Terminal States to prevent crashes
        'ENROLLED': { allowed: ['FINANCE', 'SYSADMIN', 'SUPER_ADMIN'], next: [] },
        'REJECTED': { allowed: ['SUPER_ADMIN'], next: [] },
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