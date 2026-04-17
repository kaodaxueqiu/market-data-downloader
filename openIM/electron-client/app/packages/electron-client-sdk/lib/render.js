class Emitter {
    constructor() {
        this.events = {};
    }
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(fn => {
                return fn(data);
            });
        }
        return this;
    }
    on(event, fn) {
        if (this.events[event]) {
            this.events[event].push(fn);
        }
        else {
            this.events[event] = [fn];
        }
        return this;
    }
    off(event, fn) {
        if (event && typeof fn === 'function' && this.events[event]) {
            const listeners = this.events[event];
            if (!listeners || listeners.length === 0) {
                return;
            }
            const index = listeners.findIndex(_fn => {
                return _fn === fn;
            });
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
        return this;
    }
}

let wasmSDK;
let instance;
const sdkEmitter = new Emitter();
// eslint-disable-next-line
const methodCache = new WeakMap();
async function createWasmSDK(wasmConfig) {
    if (!wasmSDK) {
        const { getSDK } = await import('@openim/wasm-client-sdk');
        wasmSDK = getSDK(wasmConfig);
    }
}
function getWithRenderProcess({ wasmConfig, invoke } = {}) {
    var _a, _b;
    const interalInvoke = invoke !== null && invoke !== void 0 ? invoke : (_a = window.openIMRenderApi) === null || _a === void 0 ? void 0 : _a.imMethodsInvoke;
    const subscribeCallback = (event, data) => sdkEmitter.emit(event, data);
    if (instance) {
        return {
            instance,
            subscribeCallback,
        };
    }
    if (!interalInvoke && !wasmSDK) {
        createWasmSDK(wasmConfig);
    }
    (_b = window.openIMRenderApi) === null || _b === void 0 ? void 0 : _b.subscribe('openim-sdk-ipc-event', subscribeCallback);
    const sdkProxyHandler = {
        get(_, prop) {
            return async (...args) => {
                try {
                    if (!interalInvoke) {
                        if (!wasmSDK) {
                            await createWasmSDK(wasmConfig);
                        }
                        const cachedMethod = methodCache.get(wasmSDK[prop]);
                        if (cachedMethod) {
                            // eslint-disable-next-line
                            return cachedMethod(...args);
                        }
                        // @ts-ignore
                        // eslint-disable-next-line
                        const method = async (...args) => wasmSDK[prop](...args);
                        methodCache.set(wasmSDK[prop], method);
                        return method(...args);
                    }
                    if (prop === 'on' || prop === 'off') {
                        // @ts-ignore
                        return sdkEmitter[prop](...args);
                    }
                    const result = await interalInvoke(prop, ...args);
                    if ((result === null || result === void 0 ? void 0 : result.errCode) !== 0 && prop !== 'initSDK') {
                        throw result;
                    }
                    return result;
                }
                catch (error) {
                    console.error(`Error invoking ${prop}:`, error);
                    throw error;
                }
            };
        },
    };
    instance = new Proxy({}, sdkProxyHandler);
    return { instance, subscribeCallback };
}

export { getWithRenderProcess };
