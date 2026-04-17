import { CbEvents, getSDK as WasmGetSDK } from '@openim/wasm-client-sdk';
import { MessageItem, WsResponse } from '@openim/wasm-client-sdk/lib/types/entity';
import { WasmPathConfig, InitAndLoginConfig } from '@openim/wasm-client-sdk/lib/types/params';
import Emitter from './utils/emitter';
import { InitConfig, FileMsgByPathParams, SoundMsgByPathParams, VideoMsgByPathParams, UploadLogsParams, DebugLogsParams, ErrorLogsParams } from './types/params';
type EmitterEvents = {
    [key in CbEvents]: any;
};
type WasmInterface = ReturnType<typeof WasmGetSDK>;
export type IMSDKInterface = Omit<WasmInterface, 'login'> & {
    login: (params: Partial<InitAndLoginConfig>, operationID?: string) => Promise<WsResponse>;
    /**
     * @access only for electron
     */
    initSDK: (param: InitConfig, opid?: string) => Promise<boolean>;
    /**
     * @access only for electron
     */
    unInitSDK: (opid?: string) => Promise<void>;
    /**
     * @access only for electron
     */
    createImageMessage: (imagePath: string, opid?: string) => Promise<WsResponse<MessageItem>>;
    /**
     * @access only for electron
     */
    createImageMessageFromFullPath: (imagePath: string, opid?: string) => Promise<WsResponse<MessageItem>>;
    /**
     * @access only for electron
     */
    createVideoMessage: (params: VideoMsgByPathParams, opid?: string) => Promise<WsResponse<MessageItem>>;
    /**
     * @access only for electron
     */
    createVideoMessageFromFullPath: (params: VideoMsgByPathParams, opid?: string) => Promise<WsResponse<MessageItem>>;
    /**
     * @access only for electron
     */
    createSoundMessage: (params: SoundMsgByPathParams, opid?: string) => Promise<WsResponse<MessageItem>>;
    /**
     * @access only for electron
     */
    createSoundMessageFromFullPath: (params: SoundMsgByPathParams, opid?: string) => Promise<WsResponse<MessageItem>>;
    /**
     * @access only for electron
     */
    createFileMessage: (params: FileMsgByPathParams, opid?: string) => Promise<WsResponse<MessageItem>>;
    /**
     * @access only for electron
     */
    createFileMessageFromFullPath: (params: FileMsgByPathParams, opid?: string) => Promise<WsResponse<MessageItem>>;
    /**
     * @access only for electron
     */
    uploadLogs: (params: UploadLogsParams, opid?: string) => Promise<WsResponse<unknown>>;
    /**
     * @access only for electron
     */
    verboseLogs: (params: DebugLogsParams, opid?: string) => Promise<WsResponse<unknown>>;
    debugLogs: (params: DebugLogsParams, opid?: string) => Promise<WsResponse<unknown>>;
    infoLogs: (params: DebugLogsParams, opid?: string) => Promise<WsResponse<unknown>>;
    warnLogs: (params: ErrorLogsParams, opid?: string) => Promise<WsResponse<unknown>>;
    errorLogs: (params: ErrorLogsParams, opid?: string) => Promise<WsResponse<unknown>>;
    fatalLogs: (params: ErrorLogsParams, opid?: string) => Promise<WsResponse<unknown>>;
    panicLogs: (params: ErrorLogsParams, opid?: string) => Promise<WsResponse<unknown>>;
};
type ElectronInvoke = (method: string, ...args: any[]) => Promise<WsResponse>;
type CreateElectronOptions = {
    wasmConfig?: WasmPathConfig;
    invoke?: ElectronInvoke;
};
export declare function getWithRenderProcess({ wasmConfig, invoke }?: CreateElectronOptions): {
    instance: IMSDKInterface;
    subscribeCallback: (event: keyof EmitterEvents, data: any) => Emitter;
};
export {};
