
export class Device {
    public id = "";
    public diy = false;
    public model = "Unknown";
    public brand = "Unknown";
    public hasVSwing  = false;
    public swingSave  = false;
    public swingPower = false;
    constructor(dev) {
        this.id    = dev.id;
        this.diy   = dev.diy;
        this.model = dev.model;
        this.brand = dev.brand;
        this.hasVSwing 	= dev.hasVSwing;
        this.swingSave	= dev.swingSave;
        this.swingPower = dev.swingPower;
    }
}