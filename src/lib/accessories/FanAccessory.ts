import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { TuyaIRPlatform } from '../../platform';
import { Config } from '../Config';
import { TuyaAPIHelper } from '../TuyaAPIHelper';

/**
 * Fan Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class FanAccessory {
    private service: Service;
    private serviceSpeedUp: Service;
    private serviceSpeedDown: Service;

    /**
     * These are just used to create a working example
     * You should implement your own code to track the state of your accessory
     */
    private fanStates = {
        On: this.platform.Characteristic.Active.INACTIVE,
        speed: 50,
        fan: 0,
        swing: this.platform.Characteristic.SwingMode.SWING_DISABLED,
        speedBeingChanged: false
    };

    private parentId: string = "";
    private tuya: TuyaAPIHelper;
    private powerCommand: number = 1;
    private speedUpCommand: number = 9367;
    private speedDownCommand: number = 9367;
    private swingCommand: number = 9372;

    constructor(
        private readonly platform: TuyaIRPlatform,
        private readonly accessory: PlatformAccessory,
    ) {
        this.parentId = accessory.context.device.ir_id;
        this.tuya = TuyaAPIHelper.Instance(new Config(platform.config.client_id, platform.config.secret, platform.config.region, platform.config.deviceId, platform.config.devices), platform.log);
        // set accessory information
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.Characteristic.Manufacturer, accessory.context.device.brand)
            .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.model)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.id);

        /********
        * Create Fan Service
        */
        this.service = this.accessory.getService(this.platform.Service.Fanv2) || this.accessory.addService(this.platform.Service.Fanv2);

        // set the service name, this is what is displayed as the default name on the Home app
        // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);
        this.service.subtype = "Fan";
        // each service must implement at-minimum the "required characteristics" for the given service type
        // see https://developers.homebridge.io/#/service/Lightbulb

        // register handlers for the On/Off Characteristic
        this.service.getCharacteristic(this.platform.Characteristic.Active)
            .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
            .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below

        this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .onSet(this.setRotationSpeed.bind(this))                // SET - bind to the `setRotationSpeed` method below
            .onGet(this.getRotationSpeed.bind(this));               // GET - bind to the `getRotationSpeed` method below

        this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
            .onSet(this.setSwingMode.bind(this))
            .onGet(this.getSwingMode.bind(this));

		/********
        * Create Speed Up service
        */
        this.serviceSpeedUp = this.accessory.getService(accessory.context.device.name + "Speed Up") || this.accessory.addService(this.platform.Service.Switch, accessory.context.device.name + "Speed Up", "Speed Up");

        // set the service name, this is what is displayed as the default name on the Home app
        // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
        this.serviceSpeedUp.setCharacteristic(this.platform.Characteristic.Name, "Speed Up");
        this.serviceSpeedUp.subtype = "Speed Up";

        // register handlers for the On/Off Characteristic
        this.serviceSpeedUp.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setRotationSpeedUp.bind(this))                // SET - bind to the `setOn` method below
            .onGet(this.getRotationSpeedUpDown.bind(this));           // GET - bind to the `getOn` method below
        
        /********
        * Create Speed Down service
        */
        this.serviceSpeedDown = this.accessory.getService(accessory.context.device.name + "Speed Down") || this.accessory.addService(this.platform.Service.Switch, accessory.context.device.name + "Speed Down", "Speed Down");

        // set the service name, this is what is displayed as the default name on the Home app
        // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
        this.serviceSpeedDown.setCharacteristic(this.platform.Characteristic.Name, "Speed Down");
        this.serviceSpeedDown.subtype = "Speed Down";

        // register handlers for the On/Off Characteristic
        this.serviceSpeedDown.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setRotationSpeedDown.bind(this))                // SET - bind to the `setOn` method below
            .onGet(this.getRotationSpeedUpDown.bind(this));             // GET - bind to the `getOn` method below
            
        setTimeout(() => {
            this.tuya.getFanCommands(this.parentId, accessory.context.device.id, accessory.context.device.diy, (commands) => {
                if (commands) {
                    this.powerCommand 	  = commands.power;
                    this.speedUpCommand   = commands.speedUp;
                    this.speedDownCommand = commands.speedDown;
                    this.swingCommand 	  = commands.swing;
                } else {
                    this.platform.log.warn(`Failed to get commands for the fan. Defaulting to standard values. These may not work.`);
                }
            })
        }, 0);
    }

    setup(platform: TuyaIRPlatform, accessory: PlatformAccessory) {

        
    }

    /**
     * Handle "SET" requests from HomeKit
     * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
     */
    async setOn(value: CharacteristicValue) {
        // implement your own code to turn your device on/off
        if (this.fanStates.On != (value as number)) {
            var command = this.powerCommand;

            this.tuya.sendFanCommand(this.parentId, this.accessory.context.device.id, command, this.accessory.context.device.diy, (body) => {
                if (!body.success) {
                    this.platform.log.error(`Failed to change Fan status due to error ${body.msg}`);
                } else {
                    this.platform.log.info(`${this.accessory.displayName} is now ${(value as number) == 0 ? 'Off' : 'On'}`);
                    
                    this.fanStates.swing = this.platform.Characteristic.SwingMode.SWING_DISABLED;
                    this.service.updateCharacteristic(this.platform.Characteristic.SwingMode, this.fanStates.swing);
                    
                    this.fanStates.On = value as number;
                    if (this.fanStates.On) {
		                this.resetSpeedUI();
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
    async getOn(): Promise<CharacteristicValue> {
        return this.fanStates.On;
    }
    
    async getRotationSpeed(): Promise<CharacteristicValue> {
        return this.fanStates.speed;
    }

    setRotationSpeed(value: CharacteristicValue) 
    {
    	if (this.fanStates.speedBeingChanged)
	    	return;
	    	
        this.fanStates.speedBeingChanged = true;
    	let speedNew = value as number;//this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed).value as number;
    	this.platform.log.info(`Speed is ${speedNew}`);
    	if (speedNew == 0)
    	{
    		this.setOn(this.platform.Characteristic.Active.INACTIVE);
    		this.fanStates.speedBeingChanged = false;
    	}
        else if (speedNew != this.fanStates.speed) {
            var command  = speedNew < this.fanStates.speed ? this.speedDownCommand : this.speedUpCommand;

            this.tuya.sendFanCommand(this.parentId, this.accessory.context.device.id, command, this.accessory.context.device.diy, (body) => {
                if (!body.success) {
                    this.platform.log.error(`Failed to change Fan speed due to error ${body.msg}`);
                } else {
                    this.platform.log.info(`${this.accessory.displayName} speed is updated.`);
					this.setFanActive();
                	this.resetSpeedUI();
                }
                this.fanStates.speedBeingChanged = false;
            }); 
        }
        else
            this.fanStates.speedBeingChanged = false;
    }

    async getRotationSpeedUpDown(): Promise<CharacteristicValue> {
        return false;
    }

    async setRotationSpeedUp(value: CharacteristicValue) {

    	var command  = this.speedUpCommand

        this.tuya.sendFanCommand(this.parentId, this.accessory.context.device.id, command, this.accessory.context.device.diy, (body) => {
            if (!body.success) {
                this.platform.log.error(`Failed to change Fan speed due to error ${body.msg}`);
            } else {
                this.platform.log.info(`${this.accessory.displayName} speed is updated.`);
				this.setFanActive();
                this.resetSpeedUI();
                this.serviceSpeedUp.updateCharacteristic(this.platform.Characteristic.On, false);
            }
        }); 
    }
    
    async setRotationSpeedDown(value: CharacteristicValue) {

    	var command  = this.speedDownCommand

        this.tuya.sendFanCommand(this.parentId, this.accessory.context.device.id, command, this.accessory.context.device.diy, (body) => {
            if (!body.success) {
                this.platform.log.error(`Failed to change Fan speed due to error ${body.msg}`);
            } else {
                this.platform.log.info(`${this.accessory.displayName} speed is updated.`);
                this.setFanActive();
                this.resetSpeedUI();
                this.serviceSpeedDown.updateCharacteristic(this.platform.Characteristic.On, false);
            }
        }); 
    }

    async getSwingMode(): Promise<CharacteristicValue> {
        return this.fanStates.swing;
    }

    async setSwingMode(value: CharacteristicValue) {
        //Change swing
        var command = this.swingCommand;

        this.tuya.sendFanCommand(this.parentId, this.accessory.context.device.id, command, this.accessory.context.device.diy, (body) => {
            if (!body.success) {
                this.platform.log.error(`Failed to change Fan swing due to error ${body.msg}`);
            } else {
                this.platform.log.info(`${this.accessory.displayName} swing is updated.`);
                this.fanStates.swing = (value as number);
                this.setFanActive();
                this.resetSpeedUI();
            }
        });
    }
    
    setFanActive()
    {
    	this.fanStates.On = this.platform.Characteristic.Active.ACTIVE;
		this.service.updateCharacteristic(this.platform.Characteristic.Active, this.fanStates.On);
    }
    
    resetSpeedUI()
    {
		this.fanStates.speed = 50;
		this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, 50);
    }
}
