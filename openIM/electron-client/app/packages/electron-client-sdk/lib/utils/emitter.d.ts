import { CbEvents } from '@openim/wasm-client-sdk';
type Cbfn = (data: unknown) => void;
declare class Emitter {
    private events;
    constructor();
    emit(event: CbEvents, data: unknown): this;
    on(event: CbEvents, fn: Cbfn): this;
    off(event: CbEvents, fn: Cbfn): this | undefined;
}
export default Emitter;
