"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FanAccessory = void 0;
const Config_1 = require("../Config");
const TuyaAPIHelper_1 = require("../TuyaAPIHelper");
/**
 * Fan Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
class FanAccessory {
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
        /**
         * These are just used to create a working example
         * You should implement your own code to track the state of your accessory
         */
        this.fanStates = {
            On: this.platform.Characteristic.Active.INACTIVE,
            speed: 50,
            fan: 0,
            swing: this.platform.Characteristic.SwingMode.SWING_DISABLED
        };
        this.parentId = "";
        this.powerCommand = 1;
        this.speedCommand = 9367;
        this.swingCommand = 9372;
        this.parentId = accessory.context.device.ir_id;
        this.tuya = TuyaAPIHelper_1.TuyaAPIHelper.Instance(new Config_1.Config(platform.config.client_id, platform.config.secret, platform.config.region, platform.config.deviceId, platform.config.devices), platform.log);
        // set accessory information
        this.accessory.getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, accessory.context.device.product_name)
            .setCharacteristic(this.platform.Characteristic.Model, 'Infrared Controlled Fan')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.id);
        // get the LightBulb service if it exists, otherwise create a new LightBulb service
        // you can create multiple services for each accessory
        this.service = this.accessory.getService(this.platform.Service.Fanv2) || this.accessory.addService(this.platform.Service.Fanv2);
        // set the service name, this is what is displayed as the default name on the Home app
        // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);
        // each service must implement at-minimum the "required characteristics" for the given service type
        // see https://developers.homebridge.io/#/service/Lightbulb
        // register handlers for the On/Off Characteristic
        this.service.getCharacteristic(this.platform.Characteristic.Active)
            .onSet(this.setOn.bind(this)) // SET - bind to the `setOn` method below
            .onGet(this.getOn.bind(this)); // GET - bind to the `getOn` method below
        this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .onSet(this.setRotationSpeed.bind(this)) // SET - bind to the `setRotationSpeed` method below
            .onGet(this.getRotationSpeed.bind(this)); // GET - bind to the `getRotationSpeed` method below
        this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
            .onSet(this.setSwingMode.bind(this)) // SET - bind to the `setRotationSpeed` method below
            .onGet(this.getSwingMode.bind(this)); // GET - bind to the `getRotationSpeed` method below
        setTimeout(() => {
            this.tuya.getFanCommands(this.parentId, accessory.context.device.id, accessory.context.device.diy, (commands) => {
                if (commands) {
                    this.powerCommand = commands.power;
                    this.speedCommand = commands.speed;
                    this.swingCommand = commands.swing;
                }
                else {
                    this.platform.log.warn(`Failed to get commands for the fan. Defaulting to standard values. These may not work.`);
                }
            });
        }, 0);
    }
    setup(platform, accessory) {
    }
    /**
     * Handle "SET" requests from HomeKit
     * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
     */
    async setOn(value) {
        // implement your own code to turn your device on/off
        if (this.fanStates.On != value) {
            var command = this.powerCommand;
            this.tuya.sendFanCommand(this.parentId, this.accessory.context.device.id, command, this.accessory.context.device.diy, (body) => {
                if (!body.success) {
                    this.platform.log.error(`Failed to change Fan status due to error ${body.msg}`);
                }
                else {
                    this.platform.log.info(`${this.accessory.displayName} is now ${value == 0 ? 'Off' : 'On'}`);
                    this.fanStates.On = value;
                    if (this.fanStates.On) {
                        this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, 50);
                    }
                }
            });
        }
    }
    /**
     * Handle the "GET" requests from HomeKit
     * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
     *
     * GET requests should return as fast as possbile. A long delay here will result in
     * HomeKit being unresponsive and a bad user experience in general.
     *
     * If your device takes time to respond you should update the status of your device
     * asynchronously instead using the `updateCharacteristic` method instead.
  
     * @example
     * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
     */
    async getOn() {
        return this.fanStates.On;
    }
    async getRotationSpeed() {
        return this.fanStates.speed;
    }
    async setRotationSpeed(value) {
        //Change termperature
        var command = this.speedCommand;
        this.tuya.sendFanCommand(this.parentId, this.accessory.context.device.id, command, this.accessory.context.device.diy, (body) => {
            if (!body.success) {
                this.platform.log.error(`Failed to change Fan speed due to error ${body.msg}`);
            }
            else {
                this.platform.log.info(`${this.accessory.displayName} speed is updated.`);
                this.fanStates.speed = 50;
                this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, 50);
            }
        });
    }
    async getSwingMode() {
        return this.fanStates.swing;
    }
    async setSwingMode(value) {
        //Change swing
        var command = this.swingCommand;
        this.tuya.sendFanCommand(this.parentId, this.accessory.context.device.id, command, this.accessory.context.device.diy, (body) => {
            if (!body.success) {
                this.platform.log.error(`Failed to change Fan swing due to error ${body.msg}`);
            }
            else {
                this.platform.log.info(`${this.accessory.displayName} swing is updated.`);
                this.fanStates.swing = value;
            }
        });
    }
}
exports.FanAccessory = FanAccessory;
//# sourceMappingURL=FanAccessory.js.map