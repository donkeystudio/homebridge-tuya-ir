"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Device = void 0;
class Device {
    constructor(dev) {
        this.id = "";
        this.diy = false;
        this.model = "Unknown";
        this.brand = "Unknown";
        this.hasVSwing = false;
        this.swingSave = false;
        this.swingPower = false;
        this.id = dev.id;
        this.diy = dev.diy;
        this.model = dev.model;
        this.brand = dev.brand;
        this.hasVSwing = dev.hasVSwing;
        this.swingSave = dev.swingSave;
        this.swingPower = dev.swingPower;
    }
}
exports.Device = Device;
//# sourceMappingURL=Device.js.map