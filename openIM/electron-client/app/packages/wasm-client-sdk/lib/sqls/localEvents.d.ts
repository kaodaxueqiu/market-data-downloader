import { Database, QueryExecResult } from '@jlongster/sql.js';
export type LocalEvent = {
    [key: string]: any;
};
export declare function localEvents(db: Database): QueryExecResult[];
export declare function insertEvent(db: Database, localEvent: LocalEvent): QueryExecResult[];
export declare function upsertEventByDedupe(db: Database, localEvent: LocalEvent): QueryExecResult[];
export declare function getNextPendingEvent(db: Database, netOK: boolean, nowMS: number): QueryExecResult[];
export declare function claimEvent(db: Database, id: string, workerID: string, leaseTTL: number, updatedAt: number): QueryExecResult[];
export declare function completeEvent(db: Database, id: string, updatedAt: number): QueryExecResult[];
export declare function failEvent(db: Database, id: string, attempts: number, lastError: string, nextRunMS: number, state: string, updatedAt: number): QueryExecResult[];
export declare function recoverExpiredLeases(db: Database, nowMS: number, updatedAt: number): QueryExecResult[];
export declare function purgeCompletedEvents(db: Database, beforeMS: number): QueryExecResult[];
