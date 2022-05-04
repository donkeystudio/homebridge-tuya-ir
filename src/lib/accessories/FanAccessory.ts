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
    private servicePower: Service;
    private serviceSpeedUp: Service;
    private serviceSpeedDown: Service;
    private serviceVSwing: Service;
    private serviceHSwing: Service;

    /**
     * These are just used to create a working example
     * You should implement your own code to track the state of your accessory
     */
    private fanStates = {
        On: false,
        swing: false,
        speedBeingChanged: false,
        verticalSwing: false
    };

    private parentId: string = "";
    private tuya: TuyaAPIHelper;
    private powerCommand: number = 1;
    private speedUpCommand: number = 9367;
    private speedDownCommand: number = 9367;
    private swingCommand: number = 9372;
    private verticalSwingCommand: number = 9372;
    private swingSave: boolean = false;
    private hasVSwing: boolean = false;
    private swingPower:boolean = false;

    constructor(
        private readonly platform: TuyaIRPlatform,
        private readonly accessory: PlatformAccessory,
    ) {
        this.parentId	= accessory.context.device.ir_id;
        this.swingSave 	= accessory.context.device.swingSave;
        this.hasVSwing 	= accessory.context.device.hasVSwing;
        this.swingPower	= accessory.context.device.swingPower;
        
        this.tuya = TuyaAPIHelper.Instance(new Config(platform.config.client_id, platform.config.secret, platform.config.region, platform.config.deviceId, platform.config.devices), platform.log);
        // set accessory information
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.Characteristic.Manufacturer, accessory.context.device.brand)
            .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.model)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.id);

        /********
        * Create Power Service
        */
        this.servicePower = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

        this.servicePower.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);
        this.servicePower.subtype = "Fan";

        this.servicePower.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setOn.bind(this))
            .onGet(this.getOn.bind(this));

		/********
        * Create Horizontal Swing Service
        */
        this.serviceHSwing = this.accessory.getService(accessory.context.device.name + "Swing") || this.accessory.addService(this.platform.Service.Switch, accessory.context.device.name + "Swing", "Swing");

        this.serviceHSwing.setCharacteristic(this.platform.Characteristic.Name, "Swing");
        this.serviceHSwing.subtype = "Swing";

        this.serviceHSwing.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setSwingMode.bind(this))
            .onGet(this.getSwingMode.bind(this));

		/********
        * Create Speed Up service
        */
        this.serviceSpeedUp = this.accessory.getService(accessory.context.device.name + "Speed Up") || this.accessory.addService(this.platform.Service.Switch, accessory.context.device.name + "Speed Up", "Speed Up");

        this.serviceSpeedUp.setCharacteristic(this.platform.Characteristic.Name, "Speed Up");
        this.serviceSpeedUp.subtype = "Speed Up";

        this.serviceSpeedUp.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setRotationSpeedUp.bind(this))
            .onGet(this.getRotationSpeedUpDown.bind(this));
        
        /********
        * Create Speed Down service
        */
        this.serviceSpeedDown = this.accessory.getService(accessory.context.device.name + "Speed Down") || this.accessory.addService(this.platform.Service.Switch, accessory.context.device.name + "Speed Down", "Speed Down");
        
        this.serviceSpeedDown.setCharacteristic(this.platform.Characteristic.Name, "Speed Down");
        this.serviceSpeedDown.subtype = "Speed Down";

        this.serviceSpeedDown.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setRotationSpeedDown.bind(this))
            .onGet(this.getRotationSpeedUpDown.bind(this));
            
        /********
        * Create Vertical Swing service
        */
        this.serviceVSwing = this.accessory.getService(accessory.context.device.name + "Vertical Swing") || this.accessory.addService(this.platform.Service.Switch, accessory.context.device.name + "Vertical Swing", "Vertical Swing");
        
		this.serviceVSwing.setCharacteristic(this.platform.Characteristic.Name, "Vertical Swing");
		this.serviceVSwing.subtype = "Vertical Swing";

		this.serviceVSwing.getCharacteristic(this.platform.Characteristic.On)
			.onSet(this.setVerticalSwing.bind(this))
			.onGet(this.getVerticalSwing.bind(this));
            
        setTimeout(() => {
            this.tuya.getFanCommands(this.parentId, accessory.context.device.id, accessory.context.device.diy, (commands) => {
                if (commands) {
                    this.powerCommand 	  		= commands.power;
                    this.speedUpCommand   		= commands.speedUp;
                    this.speedDownCommand 		= commands.speedDown;
                    this.swingCommand 	  		= commands.swing;
                    this.verticalSwingCommand 	= commands.vSwing;
                } else {
                    this.platform.log.warn(`Failed to get commands for the fan. Defaulting to standard values. These may not work.`);
                }
            })
        }, 0);
    }

    setup(platform: TuyaIRPlatform, accessory: PlatformAccessory) {

        
    }

    async setOn(value: CharacteristicValue) 
    {
        var command = this.powerCommand;

		this.tuya.sendFanCommand(this.parentId, this.accessory.context.device.id, command, this.accessory.context.device.diy, (body) => {
			if (!body.success) {
				this.platform.log.error(`Failed to change Fan status due to error ${body.msg}`);
			} else {
				this.platform.log.info(`${this.accessory.displayName} is now ${(value as number) == 0 ? 'Off' : 'On'}`);
				
				this.fanStates.On = value as boolean;
				
				//Try to enable swing after turning on the fan
				if (!this.swingSave)
				{
					if (this.fanStates.On)
					{
						this.setSwingActive();
					}
					else
					{
						this.fanStates.swing = false;
						//Set and execute Swing
						this.serviceHSwing.updateCharacteristic(this.platform.Characteristic.On, this.fanStates.swing);	
					}
				}
				
			}
		});
    }

    async getOn(): Promise<CharacteristicValue> {
        return this.fanStates.On;
    }

    async getRotationSpeedUpDown(): Promise<CharacteristicValue> {
        return false;
    }

    async setRotationSpeedUp(value: CharacteristicValue) {

    	var command  = this.speedUpCommand;

        this.tuya.sendFanCommand(this.parentId, this.accessory.context.device.id, command, this.accessory.context.device.diy, (body) => {
            if (!body.success) {
                this.platform.log.error(`Failed to change Fan speed due to error ${body.msg}`);
            } else {
                this.platform.log.info(`${this.accessory.displayName} speed is updated.`);
                
				if (this.swingPower && !this.fanStates.On)
				{
					if (!this.swingSave)
					{
						this.setSwingActive();
					}
					else
					{
						this.updateFanActive();
					}
				}
                this.serviceSpeedUp.updateCharacteristic(this.platform.Characteristic.On, false);
            }
        }); 
    }
    
    async setRotationSpeedDown(value: CharacteristicValue) {

    	var command  = this.speedDownCommand;

        this.tuya.sendFanCommand(this.parentId, this.accessory.context.device.id, command, this.accessory.context.device.diy, (body) => {
            if (!body.success) {
                this.platform.log.error(`Failed to change Fan speed due to error ${body.msg}`);
            } else {
                this.platform.log.info(`${this.accessory.displayName} speed is updated.`);
                if (this.swingPower && !this.fanStates.On)
				{
					if (!this.swingSave)
					{
						this.setSwingActive();
					}
					else
					{
						this.updateFanActive();
					}
				}
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
                this.fanStates.swing = value as boolean;
                if (this.swingPower)
	                this.updateFanActive();
            }
        });
    }
    
    async getVerticalSwing(): Promise<CharacteristicValue> {
        return this.fanStates.verticalSwing;
    }

    async setVerticalSwing(value: CharacteristicValue) {
		if (this.hasVSwing)
		{
			var command = this.verticalSwingCommand;

			this.tuya.sendFanCommand(this.parentId, this.accessory.context.device.id, command, this.accessory.context.device.diy, (body) => {
				if (!body.success) {
					this.platform.log.error(`Failed to change Fan swing due to error ${body.msg}`);
				} else {
					this.platform.log.info(`${this.accessory.displayName} swing is updated.`);
					this.fanStates.verticalSwing = value as boolean;
					if (this.swingPower)
						this.updateFanActive();
				}
			});
		}
    }
    
    updateFanActive()
    {
    	this.fanStates.On = true;
		this.servicePower.updateCharacteristic(this.platform.Characteristic.On, this.fanStates.On);
    }
    
    setSwingActive()
    {
    	this.fanStates.swing = true;
    	//Set and execute Swing
		this.serviceHSwing.setCharacteristic(this.platform.Characteristic.On, this.fanStates.swing);		
    }
}
