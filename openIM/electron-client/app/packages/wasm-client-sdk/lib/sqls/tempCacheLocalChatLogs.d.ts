import { Database, QueryExecResult } from '@jlongster/sql.js';
export type TempCacheClientMessage = {
    [key: string]: any;
};
export declare function tempCacheLocalChatLogs(db: Database): QueryExecResult[];
export declare function batchInsertTempCacheMessageList(db: Database, messageList: TempCacheClientMessage[]): QueryExecResult[];
