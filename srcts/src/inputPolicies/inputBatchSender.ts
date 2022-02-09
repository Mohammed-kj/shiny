import type { InputPolicy, InputPolicyOpts } from "./inputPolicy";
import type { ShinyApp } from "../shiny/shinyapp";

// Schedules data to be sent to shinyapp at the next setTimeout(0).
// Batches multiple input calls into one websocket message.
class InputBatchSender implements InputPolicy {
  target!: InputPolicy; // We need this ...
  shinyapp: ShinyApp;
  timerId: NodeJS.Timeout | null = null;
  pendingData: { [key: string]: unknown } = {};
  reentrant = false;
  lastChanceCallback: Array<() => void> = [];

  constructor(shinyapp: ShinyApp) {
    this.shinyapp = shinyapp;
  }

  setInput(nameType: string, value: unknown, opts: InputPolicyOpts): void {
    this.pendingData[nameType] = value;

    if (!this.reentrant) {
      if (opts.priority === "event") {
        this._sendNow();
      } else if (!this.timerId) {
        this.timerId = setTimeout(this._sendNow.bind(this), 0);
      }
    }
  }

  private _sendNow(): void {
    if (this.reentrant) {
      console.trace("Unexpected reentrancy in InputBatchSender!");
    }

    this.reentrant = true;
    try {
      this.timerId = null;
      this.lastChanceCallback.forEach((callback) => callback());
      const currentData = this.pendingData;

      this.pendingData = {};
      this.shinyapp.sendInput(currentData);
    } finally {
      this.reentrant = false;
    }
  }
}

export { InputBatchSender };
