import { WebContents } from 'electron';
declare class OpenIMSDKMain {
    private sdk;
    private webContents;
    constructor(path: string, webContent?: WebContents, enterprise?: boolean, basertc?: boolean);
    private systemStateHandler;
    private initMethodsHandler;
    private emitProxy;
    addWebContent(webContent: WebContents): void;
}
export default OpenIMSDKMain;
