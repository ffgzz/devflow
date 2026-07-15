const bridge = globalThis["__devflowWorkerRuntimeV1__"];
if (!bridge || typeof bridge.complete !== "function") {
  throw new Error("DevFlow Worker completion bridge is unavailable.");
}
bridge.complete();
//# sourceURL=devflow-worker-complete.mjs
