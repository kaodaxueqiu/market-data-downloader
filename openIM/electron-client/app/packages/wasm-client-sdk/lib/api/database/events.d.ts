export declare function insertEvent(ev: string): Promise<string>;
export declare function upsertEventByDedupe(ev: string): Promise<string>;
export declare function claimNextEvent(netOK: boolean, nowMS: number, workerID: string, leaseTTL: number): Promise<string>;
export declare function completeEvent(id: string): Promise<string>;
export declare function failEvent(id: string, attempts: number, lastError: string, nextRunMS: number, state: string): Promise<string>;
export declare function recoverExpiredLeases(nowMS: number): Promise<string>;
export declare function purgeCompletedEvents(beforeMS: number): Promise<string>;
